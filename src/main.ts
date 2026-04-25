import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS — allow frontend origin (localhost:3000 dev, FRONTEND_URL prod)
  app.enableCors({
    origin: [
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[],
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Creative OS API')
    .setDescription('MVP — Campaign → Concept → Angle → Video / Carousel / Banner')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Public health-check endpoint — bypasses UserGuard for Railway / uptime monitors
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`\n🚀 Creative OS API at http://localhost:${port}`);
  console.log(`📖 Swagger docs at  http://localhost:${port}/docs\n`);
}

bootstrap();
