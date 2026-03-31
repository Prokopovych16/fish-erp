import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SettingsService } from '../settings/settings.service';
import puppeteer from 'puppeteer';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  private async getOrderData(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        deliveryPoint: true,
        items: { include: { product: true } },
      },
    });
    if (!order) throw new NotFoundException('Заявку не знайдено');
    if (!order.completedAt)
      throw new NotFoundException('Заявка ще не завершена');
    return order;
  }

  async generateAll(orderId: string): Promise<Buffer> {
    const [invoice, ttn, quality] = await Promise.all([
      this.generateInvoice(orderId),
      this.generateTTN(orderId),
      this.generateQuality(orderId),
    ]);
    const { PDFDocument } = await import('pdf-lib');
    const merged = await PDFDocument.create();
    for (const pdfBuffer of [invoice, ttn, invoice, ttn, quality]) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
    return Buffer.from(await merged.save());
  }

  private calculateTotal(items: any[]) {
    return items.reduce((sum, item) => {
      return (
        sum +
        Number(item.actualWeight ?? item.plannedWeight) *
          Number(item.pricePerKg ?? 0)
      );
    }, 0);
  }

  private formatDate(date: Date) {
    return new Date(date).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatDateLong(date: Date) {
    const d = new Date(date);
    const months = [
      'січня',
      'лютого',
      'березня',
      'квітня',
      'травня',
      'червня',
      'липня',
      'серпня',
      'вересня',
      'жовтня',
      'листопада',
      'грудня',
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} р.`;
  }

  private getInvoiceDate(order: any): Date {
    // Якщо вказана дата накладної — використовуємо її, інакше completedAt
    return order.invoiceDate
      ? new Date(order.invoiceDate)
      : new Date(order.completedAt);
  }

  // Число прописом (гривні)
  private numberToWords(amount: number): string {
    const n = Math.round(amount * 100) / 100;
    const intPart = Math.floor(n);
    const kopPart = Math.round((n - intPart) * 100);

    const ones = [
      '',
      'один',
      'два',
      'три',
      'чотири',
      "п'ять",
      'шість',
      'сім',
      'вісім',
      "дев'ять",
      'десять',
      'одинадцять',
      'дванадцять',
      'тринадцять',
      'чотирнадцять',
      "п'ятнадцять",
      'шістнадцять',
      'сімнадцять',
      'вісімнадцять',
      "дев'ятнадцять",
    ];
    const tens = [
      '',
      'десять',
      'двадцять',
      'тридцять',
      'сорок',
      "п'ятдесят",
      'шістдесят',
      'сімдесят',
      'вісімдесят',
      "дев'яносто",
    ];
    const hundreds = [
      '',
      'сто',
      'двісті',
      'триста',
      'чотириста',
      "п'ятсот",
      'шістсот',
      'сімсот',
      'вісімсот',
      "дев'ятсот",
    ];

    const toWords = (num: number): string => {
      if (num === 0) return '';
      if (num < 20) return ones[num];
      if (num < 100)
        return (
          tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '')
        );
      return (
        hundreds[Math.floor(num / 100)] +
        (num % 100 ? ' ' + toWords(num % 100) : '')
      );
    };

    const thousands = Math.floor(intPart / 1000);
    const rest = intPart % 1000;
    let result = '';

    if (thousands > 0) {
      const tStr = toWords(thousands);
      const lastDigit = thousands % 10;
      const lastTwo = thousands % 100;
      let suffix = 'тисяч';
      if (lastTwo < 11 || lastTwo > 19) {
        if (lastDigit === 1) suffix = 'тисяча';
        else if (lastDigit >= 2 && lastDigit <= 4) suffix = 'тисячі';
      }
      result += tStr + ' ' + suffix + ' ';
    }
    result += toWords(rest);

    const intWords = result.trim() || 'нуль';
    const intCapital = intWords.charAt(0).toUpperCase() + intWords.slice(1);

    return `${intCapital} гривень ${kopPart.toString().padStart(2, '0')} копійок`;
  }

  private async generatePdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '15mm' },
      printBackground: true,
    });
    await browser.close();
    return Buffer.from(pdf);
  }

  // ============================================================
  // ВИДАТКОВА НАКЛАДНА
  // ============================================================
  async generateInvoice(orderId: string): Promise<Buffer> {
    const order = await this.getOrderData(orderId);
    const company = await this.settings.getAll();

    const displayNumber = (order as any).numberForm ?? order.number;
    const total = this.calculateTotal(order.items);
    const totalWithoutVat = total / 1.2;
    const vat = total - totalWithoutVat;
    const deliveryPoint = (order as any).deliveryPoint;

    const itemsRows = order.items
      .map((item, index) => {
        const weight = Number(item.actualWeight ?? item.plannedWeight);
        const price = Number(item.pricePerKg ?? 0);
        const priceWithoutVat = price / 1.2;
        const sumWithoutVat = weight * priceWithoutVat;
        return `
        <tr>
          <td>${index + 1}</td>
          <td style="text-align:left; padding-left:4px">${item.product.name}</td>
          <td>${item.product.unit}</td>
          <td>${weight.toFixed(3)}</td>
          <td>${priceWithoutVat.toFixed(2)}</td>
          <td>${sumWithoutVat.toFixed(2)}</td>
        </tr>
      `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
          .header-block { margin-bottom: 10px; font-size: 11px; line-height: 1.6; }
          .header-row { display: flex; margin-bottom: 3px; }
          .header-label { font-weight: bold; width: 120px; text-decoration: underline; flex-shrink: 0; }
          .header-value { flex: 1; }
          .header-sub { margin-left: 120px; font-size: 10px; color: #333; margin-bottom: 2px; }
          .divider { border-top: none; margin: 4px 0; }
          h2 { text-align: center; font-size: 14px; font-weight: bold; margin: 12px 0 2px; }
          .subtitle { text-align: center; font-size: 12px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f0f0f0; padding: 5px 4px; border: 1px solid #666; text-align: center; font-size: 10px; font-weight: bold; }
          td { padding: 4px; border: 1px solid #666; text-align: center; font-size: 11px; }
          .totals-block { margin-top: 0; }
          .totals-block table { border-collapse: collapse; width: 100%; }
          .totals-block .label { text-align: right; font-size: 11px; padding: 3px 6px; border: none; }
          .totals-block .value { text-align: right; font-weight: bold; font-size: 11px; width: 85px; border: 1px solid #666; padding: 3px 6px; }
          .total-final td.value { font-weight: bold; font-size: 12px; border: 1px solid #666; border-bottom: 1px solid #000 !important; }
          .total-final td { font-weight: bold; font-size: 12px; }
          .total-final td { font-weight: bold; font-size: 12px; border-bottom: none !important; }
          .sum-words { margin-top: 8px; font-size: 11px; line-height: 1.6; }
          .signatures { display: flex; justify-content: space-between; margin-top: 20px; font-size: 11px; }
          .sig-block { width: 47%; }
          .sig-line { border-bottom: 1px solid #000; margin: 20px 0 3px; }
          .sig-hint { font-size: 9px; text-align: center; color: #555; }
          .sig-ref { font-size: 9px; color: #555; margin-top: 4px; }
          .stamp { text-align: right; font-size: 10px; color: #aaa; margin-top: 8px; }
          .delivery-info { font-size: 10px; margin-bottom: 8px; color: #333; }
        </style>
      </head>
      <body>
        <!-- Шапка: Постачальник / Одержувач -->
        <div class="header-block">
          <div class="header-row">
            <span class="header-label">Постачальник</span>
            <span class="header-value">${company.companyName ?? ''}</span>
          </div>
          ${company.edrpou ? `<div class="header-sub">ЄДРПОУ ${company.edrpou}${company.ipn ? ', ІПН ' + company.ipn : ''}${company.phone ? ', тел. ' + company.phone : ''}</div>` : ''}
          ${company.address ? `<div class="header-sub">Адреса: ${company.address}</div>` : ''}
          ${company.iban ? `<div class="header-sub">р/р ${company.iban}</div>` : ''}

          <div class="divider"></div>

          <div class="header-row">
            <span class="header-label">Одержувач</span>
            <span class="header-value">${order.client.name}</span>
          </div>
          ${order.client.edrpou ? `<div class="header-sub">ЄДРПОУ ${order.client.edrpou}${order.client.contact ? ', тел. ' + order.client.contact : ''}</div>` : ''}
          ${order.client.address ? `<div class="header-sub">Адреса: ${order.client.address}</div>` : ''}

          <div class="divider"></div>

          <div class="header-row"><span class="header-label">Платник</span><span class="header-value">той самий</span></div>
          <div class="header-row"><span class="header-label">Замовлення:</span><span class="header-value">${(order.client as any).contractNumber || 'Без замовлення'}</span></div>
          <div class="header-row"><span class="header-label">Умова продажу:</span><span class="header-value">Безготівковий розрахунок</span></div>
        </div>

        <h2>Видаткова накладна № РН-00${displayNumber}</h2>
        <p class="subtitle">від ${this.formatDateLong(this.getInvoiceDate(order))}</p>

        

        <table>
          <thead>
            <tr>
              <th style="width:28px">№</th>
              <th>Товар</th>
              <th style="width:40px">Од.</th>
              <th style="width:70px">Кількість</th>
              <th style="width:80px">Ціна без ПДВ</th>
              <th style="width:85px">Сума без ПДВ</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Підсумки -->
        <div class="totals-block">
          <table>
            <tr>
              <td class="label" colspan="5">Разом без ПДВ:</td>
              <td class="value">${totalWithoutVat.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="label" colspan="5">ПДВ 20%:</td>
              <td class="value">${vat.toFixed(2)}</td>
            </tr>
            <tr class="total-final">
              <td class="label" colspan="5">Всього з ПДВ:</td>
              <td class="value">${total.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="sum-words">
          <b>Всього на суму:</b><br>
          ${this.numberToWords(total)}<br>
          ПДВ: ${vat.toFixed(2)} грн.
        </div>

        ${order.note ? `<div style="margin-top:6px; font-size:10px; color:#555;">Примітка: ${order.note}</div>` : ''}

        <div class="signatures">
          <div class="sig-block">
            <div>Від постачальника*</div>
            <div class="sig-line"></div>
            <div style="text-align:center; font-size:11px;">директор ${company.director ?? ''}</div>
            <div class="sig-ref">* Відповідальний за здійснення господарської операції і правильність її оформлення</div>
          </div>
          <div class="sig-block">
            <div>Отримав(ла)</div>
            <div class="sig-line"></div>
            <div style="font-size:10px;">за дов. &nbsp;&nbsp;&nbsp; № &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; від &nbsp;&nbsp; . &nbsp;&nbsp; . &nbsp;&nbsp;</div>
          </div>
        </div>

        <div class="stamp">М.П.</div>
      </body>
      </html>
    `;

    return this.generatePdf(html);
  }

  // ============================================================
  // ТТН — один аркуш
  // ============================================================
  async generateTTN(orderId: string): Promise<Buffer> {
    const order = await this.getOrderData(orderId);
    const company = await this.settings.getAll();

    const displayNumber = (order as any).numberForm ?? order.number;
    const total = this.calculateTotal(order.items);
    const totalWithoutVat = total / 1.2;
    const vat = total - totalWithoutVat;
    const totalWeight = order.items.reduce(
      (s, i) => s + Number(i.actualWeight ?? i.plannedWeight),
      0,
    );
    const deliveryPoint = (order as any).deliveryPoint;

    const itemsRows = order.items
      .map((item, idx) => {
        const weight = Number(item.actualWeight ?? item.plannedWeight);
        const price = Number(item.pricePerKg ?? 0);
        const priceWithoutVat = price / 1.2;
        const sumWithVat = weight * price;
        return `
        <tr>
          <td>${idx + 1}</td>
          <td style="text-align:left; padding-left:3px">${item.product.name}</td>
          <td>${item.product.unit}</td>
          <td>1</td>
          <td>${weight.toFixed(3)}</td>
          <td>${priceWithoutVat.toFixed(2)}</td>
          <td>${sumWithVat.toFixed(2)}</td>
          <td>${item.product.unit === 'кг' ? (weight / 1000).toFixed(3) : '—'}</td>
        </tr>
      `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }
          .top-note { text-align: right; font-size: 9px; margin-bottom: 6px; color: #333; line-height: 1.4; }
          h2 { text-align: center; font-size: 13px; font-weight: bold; margin: 8px 0 2px; }
          .doc-num { text-align: center; font-size: 11px; margin-bottom: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin-bottom: 8px; }
          .info-row { display: flex; margin-bottom: 3px; border-bottom: 1px solid #ccc; padding-bottom: 2px; font-size: 10px; }
          .info-label { color: #555; min-width: 120px; flex-shrink: 0; }
          .info-value { font-weight: bold; flex: 1; }
          .info-full { display: flex; margin-bottom: 3px; border-bottom: 1px solid #ccc; padding-bottom: 2px; font-size: 10px; }
          .info-full .info-label { min-width: 160px; }
          .section-title { font-weight: bold; font-size: 11px; text-align: center; margin: 10px 0 5px; border-top: 1px solid #000; padding-top: 6px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f0f0f0; padding: 3px 2px; border: 1px solid #666; text-align: center; font-size: 9px; font-weight: bold; line-height: 1.2; }
          td { padding: 3px 2px; border: 1px solid #666; text-align: center; font-size: 10px; }
          .total-row td { font-weight: bold; background: #f5f5f5; }
          .totals-right { margin-top: 4px; }
          .totals-right table { border: none; margin-left: auto; width: 280px; }
          .totals-right td { border: none; border-bottom: 1px solid #ccc; padding: 2px 4px; }
          .totals-right .lbl { text-align: right; }
          .totals-right .val { text-align: right; font-weight: bold; width: 80px; }
          .totals-right .final td { border-bottom: 2px solid #000 !important; font-weight: bold; }
          .sum-words { margin-top: 6px; font-size: 10px; line-height: 1.5; }
          .signatures { display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px; }
          .sig-block { width: 30%; }
          .sig-line { border-bottom: 1px solid #000; margin: 16px 0 2px; }
          .sig-hint { font-size: 8px; text-align: center; color: #666; }
          .loading-ops { margin-top: 10px; border: 1px solid #666; }
          .loading-ops th { font-size: 9px; }
          .loading-ops td { font-size: 9px; height: 18px; }
        </style>
      </head>
      <body>
        <div class="top-note">
          Додаток 7 до Правил перевезення вантажів<br>
          автомобільним транспортом в Україні<br>
          (пункт 11.1 глави 11)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Форма № 1-ТН
        </div>

        <h2>ТОВАРНО-ТРАНСПОРТНА НАКЛАДНА</h2>
        <p class="doc-num">№ &nbsp;<b>${displayNumber}</b>&nbsp;&nbsp; ${this.formatDateLong(this.getInvoiceDate(order))}</p>


        <!-- Реквізити -->
        <div class="info-grid">
          <div>
            <div class="info-full">
              <span class="info-label">Вантажовідправник:</span>
              <span class="info-value">${company.companyName ?? ''}</span>
            </div>
            ${company.edrpou ? `<div class="info-full"><span class="info-label">ЄДРПОУ:</span><span class="info-value">${company.edrpou}</span></div>` : ''}
            ${company.ipn ? `<div class="info-full"><span class="info-label">ІПН:</span><span class="info-value">${company.ipn}</span></div>` : ''}
            ${company.iban ? `<div class="info-full"><span class="info-label">р/р:</span><span class="info-value">${company.iban}</span></div>` : ''}
            ${company.address ? `<div class="info-full"><span class="info-label">Адреса:</span><span class="info-value">${company.address}</span></div>` : ''}
            ${company.phone ? `<div class="info-full"><span class="info-label">Тел.:</span><span class="info-value">${company.phone}</span></div>` : ''}
          </div>
          <div>
            <div class="info-full">
              <span class="info-label">Вантажоодержувач:</span>
              <span class="info-value">${order.client.name}</span>
            </div>
            ${order.client.edrpou ? `<div class="info-full"><span class="info-label">ЄДРПОУ:</span><span class="info-value">${order.client.edrpou}</span></div>` : ''}
            ${order.client.address ? `<div class="info-full"><span class="info-label">Адреса:</span><span class="info-value">${order.client.address}</span></div>` : ''}
            ${order.client.contact ? `<div class="info-full"><span class="info-label">Тел.:</span><span class="info-value">${order.client.contact}</span></div>` : ''}
          </div>
        </div>

        <!-- Транспорт і доставка -->
        <div style="display:flex; gap:20px; margin-bottom:6px; flex-wrap:wrap;">
          ${order.driverName ? `<div class="info-row" style="flex:1"><span class="info-label">Водій/експедитор:</span><span class="info-value">${order.driverName}</span></div>` : ''}
          ${order.carNumber ? `<div class="info-row" style="flex:1"><span class="info-label">Автомобіль:</span><span class="info-value">${order.carNumber}</span></div>` : ''}
        </div>
        <div style="display:flex; gap:20px; margin-bottom:8px;">
          <div class="info-row" style="flex:1">
            <span class="info-label">Пункт навантаження:</span>
            <span class="info-value">${company.address ?? ''}</span>
          </div>
          <div class="info-row" style="flex:1">
            <span class="info-label">Пункт розвантаження:</span>
            <span class="info-value">${deliveryPoint ? (order.client.address ? order.client.address : '') : (order.client.address ?? '')}</span>
          </div>
        </div>

        <div class="info-row">
          <span class="info-label">Усього відпущено на загальну суму:</span>
          <span class="info-value">${this.numberToWords(total)}</span>
          <span style="margin-left:10px;">у т.ч. ПДВ: <b>${vat.toFixed(2)} грн.</b></span>
        </div>

        <!-- Відомості про вантаж -->
        <div class="section-title">ВІДОМОСТІ ПРО ВАНТАЖ</div>

        <table>
          <thead>
            <tr>
              <th style="width:24px">№ з/п</th>
              <th>Найменування вантажу</th>
              <th style="width:35px">Од. вим.</th>
              <th style="width:35px">Кількість місць</th>
              <th style="width:55px">Кількість (вага)</th>
              <th style="width:65px">Ціна без ПДВ, грн</th>
              <th style="width:70px">Загальна сума з ПДВ, грн</th>
              <th style="width:55px">Маса брутто, т</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
            <tr class="total-row">
              <td colspan="4">ВСЬОГО:</td>
              <td>${totalWeight.toFixed(3)}</td>
              <td>—</td>
              <td>${total.toFixed(2)}</td>
              <td>${(totalWeight / 1000).toFixed(3)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals-right">
          <table>
            <tr><td class="lbl">Разом без ПДВ:</td><td class="val">${totalWithoutVat.toFixed(2)}</td></tr>
            <tr><td class="lbl">ПДВ 20%:</td><td class="val">${vat.toFixed(2)}</td></tr>
            <tr class="final"><td class="lbl">Всього з ПДВ:</td><td class="val">${total.toFixed(2)}</td></tr>
          </table>
        </div>

        <!-- Підписи -->
        <div class="signatures">
          <div class="sig-block">
            <div>Здав (відправник)</div>
            <div class="sig-line"></div>
            <div class="sig-hint">підпис, П.І.Б., печатка</div>
            <div style="margin-top:4px; font-size:9px;">директор ${company.director ?? ''}</div>
          </div>
          <div class="sig-block">
            <div>Прийняв (одержувач)</div>
            <div class="sig-line"></div>
            <div class="sig-hint">підпис, П.І.Б., печатка</div>
          </div>
          <div class="sig-block">
            <div>Водій</div>
            <div class="sig-line"></div>
            <div class="sig-hint">підпис</div>
          </div>
        </div>

        <!-- Вантажно-розвантажувальні операції -->
        <table class="loading-ops" style="margin-top:12px;">
          <thead>
            <tr>
              <th rowspan="2" style="width:80px">Операція</th>
              <th rowspan="2" style="width:70px">Маса брутто, т</th>
              <th colspan="2">Час (год., хв.)</th>
              <th rowspan="2">Простою</th>
              <th rowspan="2">Підпис відповідальної особи</th>
            </tr>
            <tr>
              <th>прибуття</th>
              <th>вибуття</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Навантаження</td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td>Розвантаження</td><td></td><td></td><td></td><td></td><td></td></tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    return this.generatePdf(html);
  }

  // ============================================================
  // ДЕКЛАРАЦІЯ ВИРОБНИКА
  // ============================================================
  async generateQuality(orderId: string): Promise<Buffer> {
    const order = await this.getOrderData(orderId);
    const company = await this.settings.getAll();

    const displayNumber = (order as any).numberForm ?? order.number;
    const deliveryPoint = (order as any).deliveryPoint;

    // Таблиця горизонтальна як на фото
    const itemsRows = order.items
      .map((item, index) => {
        const weight = Number(item.actualWeight ?? item.plannedWeight);
        return `
        <tr>
          <td>${index + 1}</td>
          <td style="text-align:left; padding-left:4px">${item.product.name}</td>
          <td>${weight.toFixed(3)}</td>
          <td>${item.product.unit}</td>
          <td>${this.formatDate(this.getInvoiceDate(order))}</td>
          <td>${item.product.storageTemp || '-4 до -8'}</td>
          <td>${item.product.storageDays ? item.product.storageDays + ' діб' : '20 діб'}</td>
          <td>${item.product.storageHumidity || '75-80'}</td>
          <td>${item.product.storageStandard || 'ДСТУ, ГОСТ, ТУ'}</td>
        </tr>
      `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }
          .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
          .doc-num-top { font-weight: bold; font-size: 11px; white-space: nowrap; }
          .quality-note { font-size: 9px; text-align: right; max-width: 280px; line-height: 1.3; border: 1px solid #ccc; padding: 4px 6px; }
          h2 { text-align: center; font-size: 13px; font-weight: bold; margin: 0 0 2px; }
          .subtitle { text-align: center; font-size: 10px; margin-bottom: 10px; }
          .info-block { margin-bottom: 8px; font-size: 10px; line-height: 1.7; }
          .info-row { display: flex; margin-bottom: 1px; }
          .info-label { min-width: 160px; color: #333; flex-shrink: 0; }
          .info-value { font-weight: bold; }
          .divider { border-top: 1px solid #aaa; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #f0f0f0; padding: 4px 3px; border: 1px solid #666; text-align: center; font-size: 9px; font-weight: bold; line-height: 1.2; }
          td { padding: 3px 2px; border: 1px solid #666; text-align: center; font-size: 10px; }
          .notes { margin-top: 12px; font-size: 9px; color: #333; line-height: 1.5; }
          .signatures { display: flex; justify-content: space-between; margin-top: 16px; font-size: 10px; }
          .sig-block { width: 47%; }
          .sig-line { border-bottom: 1px solid #000; margin: 20px 0 3px; }
          .sig-hint { font-size: 9px; text-align: center; color: #555; }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div>
            <div class="doc-num-top">ДЕКЛАРАЦІЯ ВИРОБНИКА № ${displayNumber}</div>
            <div style="font-size:9px; margin-top:2px;">на готову рибну продукцію</div>
          </div>
          <div class="quality-note">
            Якість продукції підтверджена впровадженою<br>
            Системою управління безпечності харчової<br>
            продукції, заснованою на принципах НАССР.
          </div>
        </div>

        <div class="info-block">
          <div class="info-row">
            <span class="info-label">Найменування підприємства — виробника:</span>
            <span class="info-value">${company.companyName ?? ''}</span>
          </div>
          ${
            company.address
              ? `
          <div class="info-row">
            <span class="info-label">Адреса:</span>
            <span class="info-value">${company.address}</span>
          </div>`
              : ''
          }
          ${
            company.phone
              ? `
          <div class="info-row">
            <span class="info-label">Тел.:</span>
            <span class="info-value">${company.phone}</span>
          </div>`
              : ''
          }
          ${
            company.director
              ? `
          <div class="info-row">
            <span class="info-label">Відповідальна особа:</span>
            <span class="info-value">${company.director}</span>
          </div>`
              : ''
          }

          <div class="divider"></div>

          <div class="info-row">
            <span class="info-label">Товароотримувач:</span>
            <span class="info-value">${order.client.name}${deliveryPoint ? ' — ' + deliveryPoint.name : ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Дата відвантаження:</span>
            <span class="info-value">${this.formatDate(this.getInvoiceDate(order))}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Накладна (специфікація) №:</span>
            <span class="info-value">${displayNumber} від ${this.formatDate(this.getInvoiceDate(order))}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:24px" rowspan="2">№</th>
              <th rowspan="2">Назва продукції</th>
              <th style="width:55px" rowspan="2">Маса (вага, кг)</th>
              <th style="width:35px" rowspan="2">Вид упак.</th>
              <th style="width:55px" rowspan="2">Дата і час виготовлення</th>
              <th style="width:50px" rowspan="2">Умови зберіг. (°C)</th>
              <th style="width:45px" rowspan="2">Термін зберіг. (діб)</th>
              <th style="width:50px" rowspan="2">Зберігати при відпов. вологості, %</th>
              <th rowspan="2">Виготовлена за технологічною інструкцією, дотриманням ветеринарно-санітарних правил відповідає нормативній документації (ГОСТ, ДСТУ, ТУ)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="notes">
          <b>Примітки:</b><br>
          1. Номер партії співпадає з датою виробництва.<br>
          2. Виробник гарантує якість виробів при дотриманні температурних режимів під час транспортування та зберігання.<br>
          3. Строк придатності риби вказується на пакувальній одиниці без порушення пакування.<br>
          4. Експлуатаційний дозвіл № ${displayNumber} для потужностей виробника.<br>
          5. Експертний висновок Nº 000548 п/25 від 29.05.2025р. виданий Хмільницьким відділенням ВРДЛ Держпродспоживслужби з питань безпечності харчових продуктів та захисту споживачів.<br>
          6. Продукція не містить ГМО. <br>
          7. Експертний висновок Nº 008799 п/25 від 31.12.2025р. виданий Вінницькою регіональною державною лабораторією ДСУ з питань безпечності харчових продуктів та захисту споживачів.<br>
        </div>

        <div class="signatures">
          <div class="sig-block">
            <div>Директор: <b>${company.director ?? ''}</b></div>
            <div class="sig-line"></div>
            <div class="sig-hint">підпис / печатка</div>
          </div>
          <div class="sig-block">
            <div>Дата: ${this.formatDate(this.getInvoiceDate(order))}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.generatePdf(html);
  }

  async generateRegistry(data: {
    rows: {
      number: any;
      client: string;
      deliveryPoint: string;
      form: string;
      total: number;
      date: Date;
    }[];
    grandTotal: number;
    from: string;
    to: string;
    form?: string;
    companyName?: string;
  }): Promise<Buffer> {
    const form1Total = data.rows
      .filter((r) => r.form === 'FORM_1')
      .reduce((s, r) => s + r.total, 0);
    const form2Total = data.rows
      .filter((r) => r.form === 'FORM_2')
      .reduce((s, r) => s + r.total, 0);

    const rows = data.rows
      .map(
        (r, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${r.number}</td>
      <td style="text-align:left">${r.client}</td>
      <td style="text-align:left">${r.deliveryPoint}</td>
      <td><span class="badge ${r.form === 'FORM_1' ? 'f1' : 'f2'}">${r.form === 'FORM_1' ? 'Ф1' : 'Ф2'}</span></td>
      <td>${new Date(r.date).toLocaleDateString('uk-UA')}</td>
      <td style="text-align:right"><b>${r.total.toFixed(2)}</b></td>
    </tr>
  `,
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
    h2 { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 10px; color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f0f0; padding: 5px 4px; border: 1px solid #999; text-align: center; font-size: 10px; }
    td { padding: 4px; border: 1px solid #ccc; text-align: center; font-size: 10px; }
    .badge { padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: bold; }
    .f1 { background: #dbeafe; color: #1d4ed8; }
    .f2 { background: #ffedd5; color: #c2410c; }
    .totals { margin-top: 10px; display: flex; gap: 20px; justify-content: flex-end; font-size: 11px; }
    .total-box { border: 1px solid #ccc; border-radius: 6px; padding: 6px 12px; text-align: center; }
    .total-box .label { font-size: 9px; color: #666; margin-bottom: 2px; }
    .total-box .value { font-weight: bold; font-size: 13px; }
  </style></head><body>
  <h2>Реєстр накладних</h2>
  <p class="subtitle">
    Період: ${data.from ? new Date(data.from).toLocaleDateString('uk-UA') : '—'} — ${data.to ? new Date(data.to).toLocaleDateString('uk-UA') : '—'}
    ${data.form ? ` · ${data.form === 'FORM_1' ? 'Форма 1 (безнал)' : 'Форма 2 (готівка)'}` : ' · Всі форми'}
  </p>
  <table>
    <thead>
      <tr>
        <th style="width:28px">№</th>
        <th style="width:50px">Накладна</th>
        <th>Клієнт</th>
        <th>Точка доставки</th>
        <th style="width:40px">Форма</th>
        <th style="width:70px">Дата</th>
        <th style="width:80px">Сума, ₴</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="font-weight:bold; background:#f5f5f5">
        <td colspan="6" style="text-align:right; padding-right:8px;">ВСЬОГО:</td>
        <td style="text-align:right">${data.grandTotal.toFixed(2)} ₴</td>
      </tr>
    </tfoot>
  </table>
  <div class="totals">
    ${!data.form || data.form === 'FORM_1' ? `<div class="total-box"><div class="label">Ф1 (безнал)</div><div class="value" style="color:#1d4ed8">${form1Total.toFixed(2)} ₴</div></div>` : ''}
    ${!data.form || data.form === 'FORM_2' ? `<div class="total-box"><div class="label">Ф2 (готівка)</div><div class="value" style="color:#c2410c">${form2Total.toFixed(2)} ₴</div></div>` : ''}
    <div class="total-box"><div class="label">Разом</div><div class="value" style="color:#16a34a">${data.grandTotal.toFixed(2)} ₴</div></div>
  </div>
  </body></html>`;

    return this.generatePdf(html);
  }

  async generateSuppliersReport(data: {
    suppliers: {
      name: string;
      items: {
        productName: string;
        qty: number;
        pricePerKg: number;
        total: number;
        date: Date;
      }[];
      total: number;
    }[];
    grandTotal: number;
    from: string;
    to: string;
  }): Promise<Buffer> {
    const suppliersHtml = data.suppliers
      .map((sup) => {
        const itemRows = sup.items
          .map(
            (item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-align:left">${item.productName}</td>
        <td>${new Date(item.date).toLocaleDateString('uk-UA')}</td>
        <td style="text-align:right">${item.qty.toFixed(3)}</td>
        <td style="text-align:right">${item.pricePerKg > 0 ? item.pricePerKg.toFixed(2) : '—'}</td>
        <td style="text-align:right"><b>${item.total > 0 ? item.total.toFixed(2) : '—'}</b></td>
      </tr>
    `,
          )
          .join('');

        return `
      <div style="margin-bottom:16px; page-break-inside:avoid;">
        <div style="background:#f0f0f0; padding:5px 8px; font-weight:bold; font-size:11px; border:1px solid #999; border-bottom:none;">
          🏭 ${sup.name} — разом: <span style="color:#16a34a">${sup.total.toFixed(2)} ₴</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:28px">№</th>
              <th>Продукт</th>
              <th style="width:70px">Дата</th>
              <th style="width:70px">Кількість, кг</th>
              <th style="width:80px">Ціна з ПДВ, ₴/кг</th>
              <th style="width:90px">Сума з ПДВ, ₴</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f9f9f9">
              <td colspan="5" style="text-align:right; padding-right:8px;">Разом по ${sup.name}:</td>
              <td style="text-align:right">${sup.total.toFixed(2)} ₴</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
      })
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
    h2 { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 10px; color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    th { background: #f0f0f0; padding: 4px; border: 1px solid #999; text-align: center; font-size: 10px; }
    td { padding: 3px 4px; border: 1px solid #ccc; text-align: center; font-size: 10px; }
    .grand-total { margin-top: 16px; text-align: right; font-size: 13px; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; }
  </style></head><body>
  <h2>Звіт по постачальниках</h2>
  <p class="subtitle">
    Період: ${data.from ? new Date(data.from).toLocaleDateString('uk-UA') : '—'} — ${data.to ? new Date(data.to).toLocaleDateString('uk-UA') : '—'}
  </p>
  ${suppliersHtml}
  <div class="grand-total">ЗАГАЛЬНА СУМА: ${data.grandTotal.toFixed(2)} ₴</div>
  </body></html>`;

    return this.generatePdf(html);
  }
}
