import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// south, west, north, east
const OBLAST_BBOX: Record<string, [number, number, number, number]> = {
  'Вінницька':        [48.15, 27.4, 49.65, 29.35], // виправлено — без Молдови
  'Волинська':        [50.0, 23.5, 52.4, 25.5],
  'Дніпропетровська': [47.5, 33.2, 49.3, 36.4],
  'Донецька':         [46.9, 36.7, 49.2, 39.0],
  'Житомирська':      [49.5, 27.3, 51.9, 30.0],
  'Закарпатська':     [47.8, 22.1, 49.0, 24.7],
  'Запорізька':       [46.5, 34.7, 48.3, 37.0],
  'Івано-Франківська':[47.9, 23.5, 49.3, 25.6],
  'Київська':         [49.5, 29.0, 51.6, 32.3],
  'Кіровоградська':   [47.6, 31.0, 49.3, 33.7],
  'Луганська':        [47.8, 38.0, 50.2, 40.4],
  'Львівська':        [49.1, 22.1, 50.5, 24.9],
  'Миколаївська':     [46.2, 30.8, 48.5, 33.5],
  'Одеська':          [45.2, 28.8, 48.0, 31.8],
  'Полтавська':       [48.4, 32.5, 50.4, 35.4],
  'Рівненська':       [50.0, 25.5, 51.8, 27.3],
  'Сумська':          [50.1, 32.4, 52.4, 35.5],
  'Тернопільська':    [49.0, 24.9, 50.2, 26.8],
  'Харківська':       [49.0, 35.4, 50.5, 38.3],
  'Херсонська':       [45.4, 32.5, 47.7, 35.0],
  'Хмельницька':      [48.8, 26.0, 50.5, 28.2],
  'Черкаська':        [48.5, 29.8, 50.1, 32.5],
  'Чернівецька':      [47.7, 24.8, 48.8, 26.6],
  'Чернігівська':     [50.7, 30.2, 52.5, 34.0],
  'Київ':             [50.2, 30.2, 50.6, 30.9],
};

const CHAIN_PATTERNS: Array<{ pattern: RegExp; chain: string }> = [
  { pattern: /\bАТБ\b|\bATB\b/i, chain: 'АТБ' },
  { pattern: /сільпо|silpo/i, chain: 'Сільпо' },
  { pattern: /новус|novus/i, chain: 'Новус' },
  { pattern: /\bMETRO\b|\bМетро\b/i, chain: 'METRO' },
  { pattern: /фоззі|fozzy/i, chain: 'Фоззі' },
  { pattern: /варус|varus/i, chain: 'Варус' },
  { pattern: /епіцентр|epicentr/i, chain: 'Епіцентр' },
  { pattern: /наш край|nash kray/i, chain: 'Наш Край' },
  { pattern: /клас|klas\b/i, chain: 'Клас' },
  { pattern: /rukavychka|рукавичка/i, chain: 'Рукавичка' },
  { pattern: /велмарт|velmart/i, chain: 'Велмарт' },
  { pattern: /ашан|auchan/i, chain: 'Ашан' },
  { pattern: /\bева\b|\beva\b/i, chain: 'EVA' },
  { pattern: /ultramarket/i, chain: 'Ultramarket' },
  { pattern: /billa/i, chain: 'BILLA' },
  { pattern: /comfy/i, chain: 'Comfy' },
];

const OBLAST_TAG_MAP: Record<string, string> = {
  'вінницька': 'Вінницька', 'vinnytsia': 'Вінницька', 'vinnytska': 'Вінницька',
  'волинська': 'Волинська', 'volyn': 'Волинська',
  'дніпропетровська': 'Дніпропетровська', 'dnipropetrovsk': 'Дніпропетровська',
  'донецька': 'Донецька', 'donetsk': 'Донецька',
  'житомирська': 'Житомирська', 'zhytomyr': 'Житомирська',
  'закарпатська': 'Закарпатська', 'zakarpattia': 'Закарпатська',
  'запорізька': 'Запорізька', 'zaporizhzhia': 'Запорізька',
  'івано-франківська': 'Івано-Франківська', 'ivano-frankivsk': 'Івано-Франківська',
  'київська': 'Київська', 'kyiv oblast': 'Київська',
  'кіровоградська': 'Кіровоградська', 'kirovohrad': 'Кіровоградська',
  'луганська': 'Луганська', 'luhansk': 'Луганська',
  'львівська': 'Львівська', 'lviv': 'Львівська',
  'миколаївська': 'Миколаївська', 'mykolaiv': 'Миколаївська',
  'одеська': 'Одеська', 'odessa': 'Одеська', 'odesa': 'Одеська',
  'полтавська': 'Полтавська', 'poltava': 'Полтавська',
  'рівненська': 'Рівненська', 'rivne': 'Рівненська',
  'сумська': 'Сумська', 'sumy': 'Сумська',
  'тернопільська': 'Тернопільська', 'ternopil': 'Тернопільська',
  'харківська': 'Харківська', 'kharkiv': 'Харківська',
  'херсонська': 'Херсонська', 'kherson': 'Херсонська',
  'хмельницька': 'Хмельницька', 'khmelnytskyi': 'Хмельницька', 'khmelnitsky': 'Хмельницька',
  'черкаська': 'Черкаська', 'cherkasy': 'Черкаська',
  'чернівецька': 'Чернівецька', 'chernivtsi': 'Чернівецька',
  'чернігівська': 'Чернігівська', 'chernihiv': 'Чернігівська',
  'київ': 'Київ', 'kyiv city': 'Київ',
};

const NON_FOOD_NAMES = /\b(wog|окко|socar|shell|upg|брсм|авіас|avias|fishka|автозапчастин|запчастин|шини|авторемонт|автосервіс|ринок авто|автомийк|carwash|мийк|банк|bank|ощадбанк|приватбанк|монобанк|пошта|nova poshta|нова пошта|meest|укрпошта|аптека|pharmacy|apteka|ліки|больниц|лікарн|hospital|клінік|stomatolog|стоматолог|школа|school|бібліотек|church|церква|храм|собор|костел|rozetka|comfy|фокстрот|eldorado|технополіс|алло|allo|мобілочка|моторсіч|watsons|watson|prostor|проспер|eva\b|brocard|parfums|l'occitane|zara|h&m|lcm|автозаправ|азс|заправк|паливо|fuel|авіа|аеро|taxi|таксі|парикмахер|перукарн|салон краси|nail|манікюр|педикюр|масаж|спортзал|фітнес|gym\b|fitness)/i;

function isNonFoodPlace(name: string, types?: string[]): boolean {
  if (NON_FOOD_NAMES.test(name)) return true;
  if (types) {
    const nonFood = ['gas_station','bank','hospital','pharmacy','school','church','beauty_salon','gym','car_repair','car_wash','car_dealer','lodging','real_estate_agency'];
    if (types.some(t => nonFood.includes(t))) return true;
  }
  return false;
}

function extractCity(address: string, oblast: string): string | null {
  if (!address) return null;
  // "вул. Шевченка 1, Вінниця, Вінницька область" → "Вінниця"
  const parts = address.split(',').map(p => p.trim());
  for (const part of parts) {
    if (part && part !== oblast && !part.includes('область') && part.length > 2 && part.length < 40) {
      return part;
    }
  }
  return null;
}

function detectOblast(tags: Record<string, string>): string | null {
  const raw =
    tags['addr:region'] || tags['addr:state'] || tags['is_in:region'] ||
    tags['is_in'] || null;
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/\s+область$/i, '').trim();
  return OBLAST_TAG_MAP[lower] || OBLAST_TAG_MAP[lower.replace(/\s+oblast$/i, '').trim()] || null;
}

function detectChain(name: string, brand?: string): string | null {
  const text = `${name} ${brand || ''}`;
  for (const { pattern, chain } of CHAIN_PATTERNS) {
    if (pattern.test(text)) return chain;
  }
  return brand || null;
}

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    oblasts?: string[];
    chains?: string[];
    isWorking?: boolean;
    isNew?: boolean;
    search?: string;
  }) {
    const where: any = {};
    if (filters.oblasts?.length) {
      where.oblast = { in: filters.oblasts };
    }
    if (filters.chains?.length) {
      where.chain = { in: filters.chains };
    }
    if (filters.isWorking !== undefined) {
      where.isWorking = filters.isWorking;
    }
    if (filters.isNew !== undefined) {
      where.isNew = filters.isNew;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { address: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.storeProspect.findMany({
      where,
      orderBy: [{ isWorking: 'desc' }, { isNew: 'desc' }, { name: 'asc' }],
    });
  }

  async getChains() {
    const result = await this.prisma.storeProspect.findMany({
      where: { chain: { not: null } },
      select: { chain: true },
      distinct: ['chain'],
      orderBy: { chain: 'asc' },
    });
    return result.map((r) => r.chain).filter(Boolean);
  }

  async getStats() {
    const [total, working, isNew, byOblast] = await Promise.all([
      this.prisma.storeProspect.count(),
      this.prisma.storeProspect.count({ where: { isWorking: true } }),
      this.prisma.storeProspect.count({ where: { isNew: true } }),
      this.prisma.storeProspect.groupBy({
        by: ['oblast'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);
    return {
      total,
      working,
      isNew,
      byOblast: byOblast.map((r) => ({ oblast: r.oblast, count: r._count.id })),
    };
  }

  async toggleWorking(id: string, notes?: string) {
    const store = await this.prisma.storeProspect.findUnique({ where: { id } });
    if (!store) throw new HttpException('Магазин не знайдено', HttpStatus.NOT_FOUND);
    return this.prisma.storeProspect.update({
      where: { id },
      data: {
        isWorking: !store.isWorking,
        isNew: false,
        ...(notes !== undefined && { notes }),
      },
    });
  }

  async updateNotes(id: string, notes: string) {
    return this.prisma.storeProspect.update({ where: { id }, data: { notes } });
  }

  async deleteStore(id: string) {
    await this.prisma.storeProspect.delete({ where: { id } });
  }

  async createManual(dto: {
    name: string; lat: number; lng: number; oblast: string;
    chain?: string; address?: string; city?: string; phone?: string;
  }) {
    return this.prisma.storeProspect.create({
      data: {
        osmId: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: dto.name,
        lat: dto.lat,
        lng: dto.lng,
        oblast: dto.oblast,
        chain: dto.chain || null,
        address: dto.address || null,
        city: dto.city || null,
        phone: dto.phone || null,
        isNew: false,
        isWorking: false,
      },
    });
  }

  private syncStatuses = new Map<string, {
    status: 'running' | 'done' | 'error';
    result?: { total: number; created: number; updated: number };
    error?: string;
    startedAt: Date;
  }>();

  getSyncStatus(oblast: string) {
    const s = this.syncStatuses.get(oblast);
    if (!s) return { status: 'idle' };
    return s;
  }

  syncOblast(oblast: string) {
    if (!OBLAST_BBOX[oblast]) throw new HttpException('Невідома область', HttpStatus.BAD_REQUEST);

    const already = this.syncStatuses.get(oblast);
    if (already?.status === 'running') return { status: 'already_running', oblast };

    this.syncStatuses.set(oblast, { status: 'running', startedAt: new Date() });
    this.runSync(oblast).catch(() => {});
    return { status: 'started', oblast };
  }

  private async runSync(oblast: string) {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY не налаштовано');

      const [s, w, n, e] = OBLAST_BBOX[oblast];
      // Dense grid ~15km step to catch small towns
      const latStep = 0.13;
      const lngStep = 0.18;
      const points: Array<{ lat: number; lng: number }> = [];
      for (let lat = s + latStep / 2; lat < n; lat += latStep) {
        for (let lng = w + lngStep / 2; lng < e; lng += lngStep) {
          points.push({ lat: +lat.toFixed(4), lng: +lng.toFixed(4) });
        }
      }

      const existingIds = await this.prisma.storeProspect
        .findMany({ where: { oblast }, select: { osmId: true } })
        .then(r => new Set(r.map(x => x.osmId)));

      const seen = new Set<string>();
      let created = 0;
      let updated = 0;

      // Three passes: supermarkets, convenience stores, keyword for small towns
      const searchTypes = ['grocery_or_supermarket', 'convenience_store'];

      for (const point of points) {
        for (const type of searchTypes) {
          const results = await this.googleNearbySearch(point.lat, point.lng, 10000, apiKey, type, undefined);
          for (const place of results) {
          const placeId: string = place.place_id;
          if (!placeId || seen.has(placeId)) continue;
          seen.add(placeId);

          const name: string = place.name || '';
          if (!name || isNonFoodPlace(name, place.types)) continue;
          const lat: number = place.geometry?.location?.lat;
          const lng: number = place.geometry?.location?.lng;
          if (!lat || !lng) continue;
          if (lat < s || lat > n || lng < w || lng > e) continue;

          const chain = detectChain(name, place.name);
          const address: string = place.vicinity || place.formatted_address || '';
          const city = extractCity(address, oblast);
          const isNewStore = !existingIds.has(placeId);

          await this.prisma.storeProspect.upsert({
            where: { osmId: placeId },
            create: {
              osmId: placeId, name, lat, lng, chain, oblast, city,
              address: address || null,
              phone: null,
              openingHours: place.opening_hours?.weekday_text?.join(', ') || null,
              website: null,
              rating: place.rating ? Number(place.rating) : null,
              isNew: true,
            },
            update: {
              name, lat, lng, chain, city, oblast,
              address: address || null,
              openingHours: place.opening_hours?.weekday_text?.join(', ') || null,
              rating: place.rating ? Number(place.rating) : null,
              isNew: isNewStore,
            },
          });

            if (isNewStore) created++;
            else updated++;
          }
          await new Promise(r => setTimeout(r, 80));
        }
        await new Promise(r => setTimeout(r, 80));
      }

      this.syncStatuses.set(oblast, {
        status: 'done',
        result: { total: seen.size, created, updated },
        startedAt: this.syncStatuses.get(oblast)!.startedAt,
      });
    } catch (e: any) {
      this.syncStatuses.set(oblast, {
        status: 'error',
        error: e.message || 'Невідома помилка',
        startedAt: this.syncStatuses.get(oblast)!.startedAt,
      });
    }
  }

  private googleNearbySearch(lat: number, lng: number, radius: number, apiKey: string, type?: string, keyword?: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const https = require('https') as typeof import('https');
      const params: Record<string, string> = {
        location: `${lat},${lng}`,
        radius: String(radius),
        language: 'uk',
        key: apiKey,
      };
      if (type) params.type = type;
      if (keyword) params.keyword = keyword;
      const qs = new URLSearchParams(params);
      const options = {
        hostname: 'maps.googleapis.com',
        path: `/maps/api/place/nearbysearch/json?${qs}`,
        method: 'GET',
        timeout: 15000,
      };
      const req = https.request(options, (res: any) => {
        let data = '';
        res.on('data', (c: any) => { data += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status === 'OK' || json.status === 'ZERO_RESULTS') {
              resolve(json.results || []);
            } else {
              reject(new Error(`Places API: ${json.status} — ${json.error_message || ''}`));
            }
          } catch {
            reject(new Error('Невалідний JSON від Places API'));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }

  async markAllSeenInOblast(oblast: string) {
    await this.prisma.storeProspect.updateMany({
      where: { oblast, isNew: true },
      data: { isNew: false },
    });
  }
}
