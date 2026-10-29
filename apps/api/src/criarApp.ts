import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from './app.module';
import type { ConfigApi } from './config';

export async function criarApp(config: ConfigApi, logs = true): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.com(config), { logger: logs ? ['log', 'warn', 'error'] : false });
  app.enableCors({ origin: config.origensCors, credentials: false });
  app.enableShutdownHooks();
  return app;
}
