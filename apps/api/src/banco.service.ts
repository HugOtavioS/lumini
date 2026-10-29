import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ServidorSincronizacao } from '@lumini/sync';

import { CONFIG, type ConfigApi } from './config';
import { ArmazenamentoSqlite } from './db/armazenamentoSqlite';
import { Banco } from './db/banco';
import { migrar } from './db/migracoes';
import { semearSeVazio } from './db/seed';

/** Banco + servidor de sincronização, compartilhados pela API inteira. */
@Injectable()
export class BancoService implements OnModuleDestroy {
  readonly banco: Banco;
  readonly servidor: ServidorSincronizacao;

  constructor(@Inject(CONFIG) config: ConfigApi) {
    this.banco = new Banco(config.caminhoBanco);
    migrar(this.banco);
    this.servidor = new ServidorSincronizacao(new ArmazenamentoSqlite(this.banco));
    if (config.semear) semearSeVazio(this.banco, this.servidor);
  }

  onModuleDestroy(): void {
    this.banco.fechar();
  }
}
