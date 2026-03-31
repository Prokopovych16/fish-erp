import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: 'http://localhost:5173', credentials: true });

  await app.listen(process.env.API_PORT || 3000);
  console.log(`API запущено на http://localhost:3000/api`);
}

bootstrap();
