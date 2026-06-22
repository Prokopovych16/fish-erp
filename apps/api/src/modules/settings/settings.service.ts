import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { spawn } from 'child_process';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // Отримати всі налаштування у вигляді об'єкту key: value
  async getAll() {
    const settings = await this.prisma.systemSettings.findMany();

    // Перетворюємо масив записів в зручний об'єкт
    // [{ key: 'companyName', value: 'ТОВ Риба' }] → { companyName: 'ТОВ Риба' }
    return settings.reduce(
      (acc, item) => {
        acc[item.key] = item.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  // Зберегти налаштування — приймаємо об'єкт і зберігаємо кожне поле
  async update(data: Record<string, string>) {
    const operations = Object.entries(data).map(([key, value]) =>
      this.prisma.systemSettings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    );

    await this.prisma.$transaction(operations);
    return this.getAll();
  }

  // Отримати одне налаштування по ключу — використовується в PDF генерації
  async getValue(key: string): Promise<string> {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { key },
    });
    return setting?.value ?? '';
  }

  // Резервна копія БД — викликає pg_dump і повертає plain SQL як Buffer
  async backupDatabase(): Promise<Buffer> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new HttpException('DATABASE_URL не налаштовано', HttpStatus.INTERNAL_SERVER_ERROR);

    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', ['--no-owner', '--no-privileges', '--clean', '--if-exists', dbUrl]);

      const chunks: Buffer[] = [];
      let stderr = '';

      pgDump.stdout.on('data', (chunk) => chunks.push(chunk));
      pgDump.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      pgDump.on('error', (err) => {
        reject(new HttpException(`pg_dump не запущено: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR));
      });

      pgDump.on('close', (code) => {
        if (code !== 0) {
          reject(new HttpException(`pg_dump завершився з помилкою: ${stderr || `код ${code}`}`, HttpStatus.INTERNAL_SERVER_ERROR));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
  }
}
