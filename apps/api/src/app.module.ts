import { Controller, Get, Module, type DynamicModule } from '@nestjs/common';

import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { BancoService } from './banco.service';
import { CONFIG, type ConfigApi } from './config';
import { ContingenciaController } from './contingencia/contingencia.controller';
import { SyncController } from './sync/sync.controller';

@Controller()
class SaudeController {
  /** GET /saude — verificação de vida (load balancer / painel). */
  @Get('saude')
  saude() {
    return { status: 'ok', servico: 'lumini-api', hora: new Date().toISOString() };
  }
}

@Module({})
export class AppModule {
  static com(config: ConfigApi): DynamicModule {
    return {
      module: AppModule,
      controllers: [SaudeController, AuthController, SyncController, ContingenciaController, AdminController],
      providers: [{ provide: CONFIG, useValue: config }, BancoService, AuthService, AdminService, AuthGuard],
    };
  }
}
