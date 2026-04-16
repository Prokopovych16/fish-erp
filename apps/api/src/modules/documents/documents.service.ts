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
    return items.reduce(
      (
        sum: number,
        item: {
          product?: { unit?: string };
          actualWeight?: unknown;
          plannedWeight?: unknown;
          pricePerKg?: unknown;
        },
      ) => {
        // шт-товар без фактичної ваги — ціну не рахуємо
        if (item.product?.unit === 'шт' && !item.actualWeight) return sum;
        // Округлюємо кожен рядок до 2 знаків (як 1С) перед додаванням
        const rowTotal =
          Math.round(
            Number(item.actualWeight ?? item.plannedWeight) *
              Number(item.pricePerKg ?? 0) *
              100,
          ) / 100;
        return sum + rowTotal;
      },
      0,
    );
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
    const total = this.calculateTotal(order.items) as number;
    const totalWithoutVat = total;
    const vat = total * 0.2;
    const totalWithVat = Number((total * 1.2).toFixed(2));

    const itemsRows = order.items
      .map((item, index) => {
        const weight = Number(item.actualWeight ?? item.plannedWeight);
        const price = Number(item.pricePerKg ?? 0);
        const sumWithoutVat = Math.round(weight * price * 100) / 100;
        return `
        <tr>
          <td>${index + 1}</td>
          <td style="text-align:left; padding-left:4px">${item.product.name}</td>
          <td>${item.product.unit}</td>
          <td>${weight.toFixed(3)}</td>
          <td>${price > 0 ? price.toFixed(2) : '—'}</td>
          <td>${price > 0 ? sumWithoutVat.toFixed(2) : '—'}</td>
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
          body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
          .header-block { margin-bottom: 10px; font-size: 12px; line-height: 1.6; }
          .header-row { display: flex; margin-bottom: 3px; }
          .header-label { font-weight: bold; width: 130px; flex-shrink: 0; }
          .header-value { flex: 1; }
          .header-sub { margin-left: 130px; font-size: 11px; color: #333; margin-bottom: 2px; }
          .divider { border-top: 1px solid #ccc; margin: 5px 0; }
          h2 { text-align: center; font-size: 15px; font-weight: bold; margin: 12px 0 2px; }
          .subtitle { text-align: center; font-size: 13px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f0f0f0; padding: 5px 4px; border: 1px solid #666; text-align: center; font-size: 11px; font-weight: bold; }
          td { padding: 4px; border: 1px solid #666; text-align: center; font-size: 12px; }
          .totals-block { margin-top: 0; }
          .totals-block table { border-collapse: collapse; width: 100%; }
          .totals-block .label { text-align: right; font-size: 12px; padding: 3px 6px; border: none; }
          .totals-block .value { text-align: right; font-weight: bold; font-size: 12px; width: 90px; border: 1px solid #666; padding: 3px 6px; }
          .total-final .label { font-weight: bold; font-size: 13px; }
          .total-final .value { font-weight: bold; font-size: 13px; border-top: 2px solid #000; }
          .sum-words { margin-top: 8px; font-size: 12px; line-height: 1.6; }
          .signatures { display: flex; justify-content: space-between; margin-top: 20px; font-size: 12px; }
          .sig-block { width: 47%; }
          .sig-line { border-bottom: 1px solid #000; margin: 20px 0 3px; }
          .sig-hint { font-size: 10px; text-align: center; color: #555; }
          .sig-ref { font-size: 10px; color: #555; margin-top: 4px; }
          .stamp { text-align: right; font-size: 11px; color: #aaa; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header-block">
          <div class="header-row">
            <span class="header-label">Постачальник:</span>
            <span class="header-value">${company.companyName ?? ''}</span>
          </div>
          ${company.edrpou ? `<div class="header-sub">ЄДРПОУ ${company.edrpou}${company.ipn ? ', ІПН ' + company.ipn : ''}${company.phone ? ', тел. ' + company.phone : ''}</div>` : ''}
          ${company.address ? `<div class="header-sub">Адреса: ${company.address}</div>` : ''}
          ${(order.client as { bankAccount?: string | null }).bankAccount ? `<div class="header-sub">р/р ${(order.client as { bankAccount?: string | null }).bankAccount}</div>` : company.iban ? `<div class="header-sub">р/р ${company.iban}</div>` : ''}

          <div class="divider"></div>

          <div class="header-row">
            <span class="header-label">Одержувач:</span>
            <span class="header-value">${order.client.name}</span>
          </div>
          ${order.client.edrpou ? `<div class="header-sub">ЄДРПОУ ${order.client.edrpou}${order.client.contact ? ', тел. ' + order.client.contact : ''}</div>` : ''}
          ${order.client.address ? `<div class="header-sub">Адреса: ${order.client.address}</div>` : ''}

          <div class="divider"></div>

          <div class="header-row"><span class="header-label">Платник:</span><span class="header-value">той самий</span></div>
          <div class="header-row"><span class="header-label">Умова продажу:</span><span class="header-value">Безготівковий розрахунок</span></div>
        </div>

        <h2>Видаткова накладна № ${displayNumber}</h2>
        <p class="subtitle">від ${this.formatDateLong(this.getInvoiceDate(order))}</p>

        <table>
          <thead>
            <tr>
              <th style="width:28px">№</th>
              <th>Товар</th>
              <th style="width:40px">Од.</th>
              <th style="width:70px">Кількість</th>
              <th style="width:80px">Ціна без ПДВ</th>
              <th style="width:90px">Сума без ПДВ</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="totals-block">
          <table>
            <tr>
              <td class="label" colspan="5">Разом без ПДВ:</td>
              <td class="value">${totalWithoutVat.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="label" colspan="5">ПДВ:</td>
              <td class="value">${vat.toFixed(2)}</td>
            </tr>
            <tr class="total-final">
              <td class="label" colspan="5">Всього з ПДВ:</td>
              <td class="value">${totalWithVat.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="sum-words">
          <b>Всього на суму:</b> ${this.numberToWords(totalWithVat)}<br>
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

  private countToWords(n: number): string {
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
    if (n === 0) return 'нуль';
    if (n < 20) return ones[n];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return (
      hundreds[Math.floor(n / 100)] +
      (n % 100 ? ' ' + this.countToWords(n % 100) : '')
    );
  }

  private capitalizeFirst(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private weightToWords(kg: number): string {
    const tons = Math.floor(kg / 1000);
    const remKg = Math.round(kg % 1000);
    const parts: string[] = [];
    const tonsStr = this.countToWords(tons);
    const tLast = tons % 10;
    const tLastTwo = tons % 100;
    let tSuffix = 'тон';
    if (tLastTwo < 11 || tLastTwo > 19) {
      if (tLast === 1) tSuffix = 'тона';
      else if (tLast >= 2 && tLast <= 4) tSuffix = 'тони';
    }
    parts.push(tonsStr + ' ' + tSuffix);
    if (remKg > 0) {
      const kgStr = this.countToWords(remKg);
      const kLast = remKg % 10;
      const kLastTwo = remKg % 100;
      let kSuffix = 'кілограм';
      if (kLastTwo < 11 || kLastTwo > 19) {
        if (kLast === 1) kSuffix = 'кілограм';
        else if (kLast >= 2 && kLast <= 4) kSuffix = 'кілограми';
      }
      parts.push(kgStr + ' ' + kSuffix);
    }
    return this.capitalizeFirst(parts.join(' '));
  }

  private extractCity(address: string): string {
    const match = address.match(/м\.?\s+([А-ЯҐЄІЇа-яґєії\-']+)/);
    return match
      ? 'м. ' + match[1]
      : address.split(',').pop()?.trim() || address;
  }

  async generateTTN(orderId: string): Promise<Buffer> {
    const order = await this.getOrderData(orderId);
    const company = await this.settings.getAll();

    const displayNumber = (order as any).numberForm ?? order.number;
    const total = this.calculateTotal(order.items) as number;
    const vat = total * 0.2;
    const totalWithVat = Number((total * 1.2).toFixed(2));
    const totalWeightKg = order.items
      .filter((i) => i.product.unit === 'кг')
      .reduce((s, i) => s + Number(i.actualWeight ?? i.plannedWeight), 0);
    const deliveryPoint = (order as any).deliveryPoint;
    const deliveryAddress =
      deliveryPoint?.address || order.client.address || '';
    const invoiceDate = this.getInvoiceDate(order);
    const city = this.extractCity(company.address ?? '');
    const itemCount = order.items.length;
    const countWords = this.capitalizeFirst(this.countToWords(itemCount));
    const weightWords = this.weightToWords(totalWeightKg);

    const itemsRows = order.items
      .map((item, idx) => {
        const weight = Number(item.actualWeight ?? item.plannedWeight);
        const price = Number(item.pricePerKg ?? 0);
        const sumWithVat = (Math.round(weight * price * 100) / 100) * 1.2;
        const p = item.product as {
          storageTemp?: string;
          packagingType?: string;
        };
        const vidUpak =
          p.packagingType || (item.product.unit === 'шт' ? 'баночка' : 'в/у');
        const masaBrutto =
          item.product.unit === 'кг' ? (weight / 1000).toFixed(3) : '—';
        return `
        <tr>
          <td>${idx + 1}</td>
          <td style="text-align:left; padding-left:3px">${item.product.name}</td>
          <td></td>
          <td>авто</td>
          <td>${item.product.unit}</td>
          <td>1</td>
          <td>${price > 0 ? price.toFixed(2) : '—'}</td>
          <td>${price > 0 ? sumWithVat.toFixed(2) : '—'}</td>
          <td>${vidUpak}</td>
          <td style="font-size:8px">накладна № ${displayNumber} від ${this.formatDate(invoiceDate)}</td>
          <td>${masaBrutto}</td>
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
          body { font-family: Arial, sans-serif; font-size: 9.5px; color: #000; }
          .top-right { text-align: right; font-size: 8.5px; line-height: 1.4; margin-bottom: 2px; }
          h2 { text-align: center; font-size: 13px; font-weight: bold; margin: 3px 0 1px; }
          .doc-num { text-align: center; font-size: 11px; margin-bottom: 3px; }
          /* Info table — реквізити без рамок */
          .it { width: 100%; border-collapse: collapse; margin-bottom: 0; }
          .it td { border: none; border-bottom: 1px solid #ccc; padding: 2px 4px; vertical-align: top; font-size: 9.5px; }
          .sub { font-size: 7.5px; color: #555; display: block; margin-bottom: 1px; line-height: 1.3; }
          .val { font-weight: bold; }
          /* Goods table */
          .gt { width: 100%; border-collapse: collapse; margin-top: 2px; }
          .gt th { background: #f0f0f0; padding: 1px 1px; border: 1px solid #666; text-align: center; font-size: 7px; font-weight: bold; line-height: 1.1; }
          .gt td { padding: 1px 1px; border: 1px solid #666; text-align: center; font-size: 8px; line-height: 1.2; }
          .total-row td { font-weight: bold; background: #f5f5f5; }
          /* Section title */
          .sect { font-weight: bold; font-size: 10px; text-align: center; margin: 3px 0 2px; text-transform: uppercase; }
          /* Signatures */
          .sigs { display: flex; justify-content: space-between; margin-top: 6px; font-size: 9px; }
          .sig { width: 32%; }
          .sig-line { border-bottom: 1px solid #000; margin: 12px 0 2px; }
          .sig-hint { font-size: 7.5px; text-align: center; color: #666; }
          /* Loading ops */
          .lops th { font-size: 8px; padding: 2px; }
          .lops td { font-size: 8px; height: 14px; }
          .note-foot { font-size: 7.5px; color: #444; margin-top: 3px; line-height: 1.4; }
        </style>
      </head>
      <body>
        <div class="top-right">
          Додаток 7 до Правил перевезення вантажів автомобільним транспортом в Україні&nbsp;&nbsp;&nbsp;&nbsp;(пункт 11.1 глави 11)<br><br>
          Форма № 1-ТН
        </div>

        <h2>ТОВАРНО-ТРАНСПОРТНА НАКЛАДНА</h2>
        <p class="doc-num">№ &nbsp;<b>${displayNumber}</b>&nbsp;&nbsp;&nbsp; ${this.formatDateLong(invoiceDate)}</p>

        <!-- Рядок 1: місце складання / вид перевезень -->
        <table class="it">
          <tr>
            <td style="width:60%">
              <span class="sub">Місце складання (місто, населений пункт):</span>
              <span class="val">${city}</span>
            </td>
            <td>
              <span class="sub">Вид перевезень:</span>
              <span class="val">ВАНТАЖНІ</span>
            </td>
          </tr>
        </table>

        <!-- Рядок 2: автомобіль / причіп -->
        <table class="it">
          <tr>
            <td style="width:60%">
              <span class="sub">Автомобіль (марка, модель, тип, рік виготовлення, реєстраційний знак):</span>
              <span class="val">${order.carNumber ?? ''}</span>
            </td>
            <td>
              <span class="sub">Причіп/Напівпричіп (марка, модель, тип, рік виготовлення, реєстраційний знак):</span>
              <span class="val"></span>
            </td>
          </tr>
        </table>

        <!-- Рядок 3: замовник / перевізник -->
        <table class="it">
          <tr>
            <td style="width:50%">
              <span class="sub">Замовник (платник) (повне найменування, форма власності та організаційно-правова форма юридичної особи, для нерезидентів — назва держави де зареєстровано суб'єкта господарювання):</span>
              <div class="val">${order.client.name}</div>
              <span class="sub">ЄДРПОУ/ДРФО: ${order.client.edrpou ?? ''}</span>
            </td>
            <td>
              <span class="sub">Автомобільний перевізник (повне найменування, форма власності та організаційно-правова форма юридичної особи, прізвище, ім'я, по батькові фізичної особи — суб'єкта підприємницької діяльності):</span>
              <div class="val">${company.carrierName ?? ''}</div>
              <span class="sub">ЄДРПОУ/ДРФО: ${company.carrierEdrpou ?? ''}</span>
            </td>
          </tr>
        </table>

        <!-- Вантажовідправник -->
        <table class="it">
          <tr>
            <td>
              <span class="sub">Вантажовідправник (повне найменування, форма власності та організаційно-правова форма юридичної особи; прізвище, ім'я, по батькові фізичної особи — суб'єкта підприємницької діяльності; для нерезидентів — назва держави де зареєстровано суб'єкта господарювання):</span>
              <div class="val">${company.companyName ?? ''}</div>
              <span class="sub">ЄДРПОУ/ДРФО: ${company.edrpou ?? ''}&nbsp;&nbsp; ІПН: ${company.ipn ?? ''}&nbsp;&nbsp; Адреса: ${company.address ?? ''}&nbsp;&nbsp; Тел.: ${company.phone ?? ''}</span>
            </td>
          </tr>
        </table>

        <!-- Вантажоодержувач -->
        <table class="it">
          <tr>
            <td>
              <span class="sub">Вантажоодержувач (повне найменування, форма власності та організаційно-правова форма юридичної особи; прізвище, ім'я, по батькові фізичної особи — суб'єкта підприємницької діяльності; для нерезидентів — назва держави де зареєстровано суб'єкта господарювання):</span>
              <div class="val">${order.client.name}</div>
              <span class="sub">ЄДРПОУ/ДРФО: ${(order.client as any).edrpou ?? ''}&nbsp;&nbsp; Адреса: ${order.client.address ?? ''}&nbsp;&nbsp; Тел.: ${order.client.contact ?? ''}</span>
            </td>
          </tr>
        </table>

        <!-- Пункти навантаження / розвантаження -->
        <table class="it">
          <tr>
            <td style="width:50%">
              <span class="sub">Пункт навантаження:</span>
              <span class="val">${company.address ?? ''}</span>
            </td>
            <td>
              <span class="sub">Пункт розвантаження:</span>
              <span class="val">${deliveryAddress}</span>
            </td>
          </tr>
        </table>

        <!-- Кількість місць / маса брутто / водій -->
        <table class="it">
          <tr>
            <td style="width:28%">
              <span class="sub">Кількість місць (словами):</span>
              <span class="val">${countWords}</span>
            </td>
            <td style="width:38%">
              <span class="sub">маса брутто, т (словами):</span>
              <span class="val">${weightWords}</span>
            </td>
            <td>
              <span class="sub">водій/Експедитор (прізвище, ім'я, по батькові, що отримав вантаж):</span>
              <span class="val">${order.driverName ?? ''}</span>
              &nbsp;&nbsp; підпис: ____________
            </td>
          </tr>
        </table>

        <!-- Відомості про транспортний засіб -->
        <table class="it">
          <tr>
            <td colspan="3" style="font-size:8px;">
              Відомості про транспортний засіб (автомобіль/автопоїзд/комбінований транспортний засіб)
            </td>
          </tr>
          <tr>
            <td style="text-align:center; width:33%">6.00<br><span class="sub" style="text-align:center; display:block">(довжина, м)</span></td>
            <td style="text-align:center; width:33%">2.50<br><span class="sub" style="text-align:center; display:block">(ширина, м)</span></td>
            <td style="text-align:center">2.40<br><span class="sub" style="text-align:center; display:block">(висота, м)</span></td>
          </tr>
        </table>

        <!-- Усього на суму -->
        <table class="it">
          <tr>
            <td>
              <span class="sub">Усього відпущено на загальну суму:</span>
              <b>${this.numberToWords(totalWithVat)}</b>
              &nbsp;&nbsp;&nbsp; у т.ч. ПДВ: <b>${vat.toFixed(2)} грн.</b>
            </td>
          </tr>
        </table>

        <!-- Супровідні документи -->
        <table class="it">
          <tr>
            <td style="min-height:16px">
              <span class="sub">Супровідні документи на вантаж:</span>
            </td>
          </tr>
        </table>

        <!-- Мітка зворотного боку -->
        <div style="display:flex; justify-content:space-between; margin:3px 0 1px; font-size:7.5px;">
          <span>Продовження додатку 7</span>
          <span style="font-weight:bold">Зворотний бік</span>
        </div>

        <!-- ВІДОМОСТІ ПРО ВАНТАЖ -->
        <div class="sect">ВІДОМОСТІ ПРО ВАНТАЖ</div>
        <table class="gt">
          <thead>
            <tr>
              <th style="width:18px">№ з/п</th>
              <th>Найменування вантажу</th>
              <th style="width:24px">Ідент. номер тварини</th>
              <th style="width:30px">Вид транспорт.</th>
              <th style="width:24px">Одиниця виміру</th>
              <th style="width:26px">Кіл-ть місць</th>
              <th style="width:42px">Ціна без ПДВ, грн</th>
              <th style="width:48px">Сума з ПДВ, грн</th>
              <th style="width:34px">Вид пакування</th>
              <th style="width:52px">Накладна №</th>
              <th style="width:34px">Маса брутто, т</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
            <tr class="total-row">
              <td colspan="5" style="text-align:right; padding-right:4px;">Всього:</td>
              <td>${order.items.length}</td>
              <td>—</td>
              <td>${totalWithVat.toFixed(2)}</td>
              <td></td>
              <td></td>
              <td>${totalWeightKg > 0 ? (totalWeightKg / 1000).toFixed(3) : '—'}</td>
            </tr>
          </tbody>
        </table>

        <!-- Підписи -->
        <div class="sigs" style="margin-top:6px;">
          <div class="sig">
            <div>Здав (відправник)</div>
            <div class="sig-line"></div>
            <div class="sig-hint">підпис, П.І.Б., печатка</div>
            <div style="margin-top:2px; font-size:7.5px;">директор ${company.director ?? ''}</div>
          </div>
          <div class="sig">
            <div>Прийняв (відповідальна особа вантажоодержувача)</div>
            <div class="sig-line"></div>
            <div class="sig-hint">підпис, П.І.Б., печатка</div>
          </div>
          <div class="sig">
            <div>Водій</div>
            <div class="sig-line"></div>
            <div class="sig-hint">підпис</div>
          </div>
        </div>

        <!-- Вантажно-розвантажувальні операції -->
        <div class="sect" style="margin-top:6px;">ВАНТАЖНО-РОЗВАНТАЖУВАЛЬНІ ОПЕРАЦІЇ</div>
        <table class="gt lops">
          <thead>
            <tr>
              <th rowspan="2" style="width:80px">Операція</th>
              <th rowspan="2" style="width:60px">Маса брутто, т</th>
              <th colspan="2">Час (год., хв.)</th>
              <th rowspan="2">Простій</th>
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

        <div class="note-foot">
          * відомості заповнюються у разі перевезення харчових продуктів, які потребують дотримання температурного режиму<br>
          ** відомості заповнюються у разі перевезення тварин, тушок тварин, тощо
        </div>
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
    const invoiceDate = this.getInvoiceDate(order);
    const frCode = '02-23-27 FR';

    const itemsRows = order.items
      .map((item, index) => {
        const weight = Number(item.actualWeight ?? item.plannedWeight);
        const prod = item.product as {
          storageTemp?: string;
          storageDays?: number;
          storageHumidity?: string;
          storageStandard?: string;
          packagingType?: string;
        };
        const vidUpak =
          prod.packagingType ||
          (item.product.unit === 'шт' ? 'баночка' : 'в/у');
        const kilUpak = item.product.unit === 'шт' ? Math.round(weight) : 1;
        return `
        <tr>
          <td>${index + 1}</td>
          <td style="text-align:left; padding-left:4px">${item.product.name}</td>
          <td>${weight.toFixed(2)}</td>
          <td>${vidUpak}</td>
          <td>${kilUpak}</td>
          <td>${this.formatDate(invoiceDate)}</td>
          <td>${prod.storageTemp || '0 до -5'}</td>
          <td>${prod.storageDays ?? '30'}</td>
          <td>${prod.storageHumidity || '75-80'}</td>
          <td style="text-align:left; padding-left:3px; font-size:8px">${prod.storageStandard || 'ДСТУ, ГОСТ, ТУ'}</td>
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
          /* Header layout */
          .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 6px; }
          .doc-header-left { flex: 1; }
          .doc-title { font-size: 13px; font-weight: bold; text-align: center; margin: 4px 0 1px; }
          .doc-subtitle { text-align: center; font-size: 10px; margin-bottom: 6px; }
          /* Field rows */
          .fr { display: flex; padding: 2px 0; font-size: 9.5px; }
          .fl { color: #444; min-width: 150px; flex-shrink: 0; }
          .fv { font-weight: bold; flex: 1; }
          /* HACCP box */
          .haccp-wrap { text-align: right; min-width: 200px; }
          .fr-code { font-size: 10px; font-weight: bold; text-align: right; margin-bottom: 4px; }
          .nassr { border: 1px solid #999; padding: 5px 8px; font-size: 9px; line-height: 1.4; text-align: center; display: inline-block; }
          /* Table */
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { background: #f0f0f0; padding: 3px 2px; border: 1px solid #666; text-align: center; font-size: 8px; font-weight: bold; line-height: 1.3; }
          td { padding: 2px 2px; border: 1px solid #666; text-align: center; font-size: 9.5px; }
          /* Notes */
          .notes { margin-top: 8px; font-size: 9px; color: #333; line-height: 1.6; }
          /* Signatures */
          .sigs { display: flex; justify-content: space-between; margin-top: 12px; font-size: 10px; }
          .sig { width: 47%; }
          .sig-line { border-bottom: 1px solid #000; margin: 16px 0 2px; }
          .sig-hint { font-size: 8.5px; text-align: center; color: #555; }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div class="doc-header-left">
            <div class="doc-title">ДЕКЛАРАЦІЯ ВИРОБНИКА № ${displayNumber}</div>
            <div class="doc-subtitle">на готову рибну продукцію</div>
            <div class="fr"><span class="fl">Найменування підприємства - виробника: </span><span class="fv">${company.address ?? ''}</span></div>
            <div class="fr"><span class="fl">Відправник ${company.companyName ?? ''}</span><span class="fv">№ тел. ${company.phone ?? ''}</span></div>
            <div class="fr"><span class="fl">Товароотримувач</span><span class="fv">${order.client.name}${deliveryPoint ? ' — ' + (deliveryPoint as any).name : ''}</span></div>
            <div class="fr"><span class="fl">Дата відвантаження</span><span class="fv">${this.formatDate(invoiceDate)}. Вид і номер транспортного засобу: ${order.carNumber ?? ''}</span></div>
            <div class="fr"><span class="fl">Накладна(специфікація) №</span><span class="fv">${displayNumber} від ${this.formatDate(invoiceDate)}. Для реалізації</span></div>
          </div>
          <div class="haccp-wrap">
            ${frCode ? `<div class="fr-code">${frCode}</div>` : ''}
            <div class="nassr">
              <b>Якість продукції підтверджена</b><br>
              впровадженням<br>
              Системи управління безпечності<br>
              харчової продукції,<br>
              заснованою на принципах<br>
              <b>НАССР</b>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:20px">№</th>
              <th>Назва продукції</th>
              <th style="width:46px">Маса (вага, кг)</th>
              <th style="width:38px">Вид упаковки</th>
              <th style="width:42px">Кількість упаковок</th>
              <th style="width:52px">Дата і час виготовлення</th>
              <th style="width:44px">Умови зберігання (t °)</th>
              <th style="width:38px">Термін зберігання (діб)</th>
              <th style="width:48px">Зберігати при відповідній вологості, %</th>
              <th>Виготовлена за технологічною інструкцією дотриманням ветеринарно-санітарних правил відповідає відповідній нормативній документації (ГОСТ, ГСТУ, і ТУ, ДСТУ ГОСТ)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="notes">
          1. Номер партії співпадає з датою виробництва.<br>
          2. Виробник гарантує якість виробів при дотриманні температурних режимів під час транспортування та зберігання.<br>
          3. Строк придатності риби вказується на пакувальній одиниці без порушення пакування.<br>
          4. Експлуатаційний дозвіл № 02-23-27 FR для потужностей (об'єктів) з виробництва, переробки або реалізації харчових продуктів від 04.05.2008 р.<br>
          5. Експертний висновок №008799 п/25 від 31.12.2025р. виданий Хмільницькою МДЛДСУ з питань безпечності харчових продуктів та захисту споживачів.<br>
          6. Продукція не містить ГМО.<br>
          7. Експертний висновок № 003212 п/20 від 01.07.2020р. виданий Вінницькою регіональною державною лабораторією ДСУ з питань безпечності харчових продуктів та захисту споживачів.<br>
        </div>

        <div class="sigs">
          <div class="sig">
            <div><b>${company.director ?? ''}</b></div>
            <div class="sig-line"></div>
            <div class="sig-hint">підпис / печатка</div>
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
