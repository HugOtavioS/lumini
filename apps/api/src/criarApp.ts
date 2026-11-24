import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import type { ConfigApi } from './config';
import { Limitador, middlewareLimitador } from './seguranca/limitador';

export async function criarApp(config: ConfigApi, logs = true): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.com(config), { logger: logs ? ['log', 'warn', 'error'] : false, bodyParser: false });
  app.enableCors({ origin: config.origensCors, credentials: false });
  // SCRUM-32: corpo limitado e limitação de uso (geral e de login).
  if (config.limites.confiarProxy) app.set('trust proxy', 1);
  app.useBodyParser('json', { limit: config.limites.corpoMaximo });
  app.use(middlewareLimitador(new Limitador(config.limites), config.limites));
  app.enableShutdownHooks();
  return app;
}
