import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';

import { BancoService } from '../banco.service';

// SCRUM-85 (lado da API) — a base de contingência (HSP por UF) que o
// ContingencyUpdater do app consulta quando está online. Dado público, sem login.

@Controller('contingencia')
export class ContingenciaController {
  constructor(@Inject(BancoService) private readonly bd: BancoService) {}

  @Get('versao')
  versaoAtual() {
    const v = this.bd.banco.um<{ versao: string; publicada_em: string }>(
      'SELECT versao, publicada_em FROM contingencia_versao ORDER BY publicada_em DESC LIMIT 1',
    );
    if (!v) throw new NotFoundException('Nenhuma base de contingência publicada.');
    return { versao: v.versao, publicadaEm: v.publicada_em };
  }

  @Get(':versao')
  baixar(@Param('versao') versao: string) {
    const v = this.bd.banco.um<{ versao: string; publicada_em: string; dados: string }>(
      'SELECT * FROM contingencia_versao WHERE versao = ?', versao,
    );
    if (!v) throw new NotFoundException(`Versão ${versao} não encontrada.`);
    return { versao: v.versao, publicadaEm: v.publicada_em, hsp: JSON.parse(v.dados) as unknown };
  }
}
