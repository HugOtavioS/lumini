import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import type { RequisicaoPull, RequisicaoPush, RespostaPull } from '@lumini/sync';

import { AuthGuard, Usuario } from '../auth/auth.guard';
import type { UsuarioAutenticado } from '../auth/auth.service';
import { BancoService } from '../banco.service';

// SCRUM-30 — POST /sync/push e POST /sync/pull (contrato do @lumini/sync).
// As regras (RN07, RN11, dependências, reenvio, last-write-wins com Log de
// Auditoria e avisos) são as do servidor de referência do Pedro, gravando no
// SQLite. A API não calcula nada (D15).

@Controller('sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(@Inject(BancoService) private readonly bd: BancoService) {}

  @Post('push')
  @HttpCode(200)
  push(@Usuario() usuario: UsuarioAutenticado, @Body() corpo: RequisicaoPush) {
    return this.bd.servidor.push(usuario, corpo);
  }

  @Post('pull')
  @HttpCode(200)
  pull(@Usuario() usuario: UsuarioAutenticado, @Body() corpo: RequisicaoPull & { idDispositivo?: string }): RespostaPull {
    const resposta = this.bd.servidor.pull(usuario, { cursor: corpo?.cursor ?? null, idDispositivo: corpo?.idDispositivo });
    if (usuario.papel === 'Gestor') return resposta;
    // O técnico recebe só os registros da carteira dele (clientes e propostas sob sua responsabilidade).
    const meus = this.registrosDoTecnico(usuario);
    return { ...resposta, registros: resposta.registros.filter((r) => meus.has(`${r.entidade}:${r.versao.id}`)) };
  }

  /**
   * GET /sync/catalogo — catálogo ativo da empresa, para o app (RF15/RF17).
   * O técnico só lê; cadastro e preço são do gestor (RF25, RN06).
   */
  @Get('catalogo')
  catalogo(@Usuario() usuario: UsuarioAutenticado) {
    const linhas = this.bd.banco.todos<{ dados: string; preco_venda: number; updated_at: string }>(
      "SELECT dados, preco_venda, updated_at FROM equipamento WHERE id_empresa = ? AND status = 'Ativo' ORDER BY categoria, fabricante, modelo",
      usuario.idEmpresa,
    );
    return {
      atualizadoEm: linhas.reduce((max, l) => (l.updated_at > max ? l.updated_at : max), ''),
      equipamentos: linhas.map((l) => ({ ...(JSON.parse(l.dados) as Record<string, unknown>), precoVenda: l.preco_venda })),
    };
  }

  private registrosDoTecnico(usuario: UsuarioAutenticado): Set<string> {
    const linhas = this.bd.banco.todos<{ chave: string }>(
      `WITH cli AS (SELECT id_cliente FROM vw_cliente WHERE id_empresa = ?1 AND id_usuario_responsavel = ?2),
            ins AS (SELECT id_instalacao FROM vw_instalacao WHERE id_empresa = ?1 AND id_cliente IN (SELECT id_cliente FROM cli)),
            pro AS (SELECT id_proposta FROM vw_proposta WHERE id_empresa = ?1 AND (id_usuario_responsavel = ?2 OR id_instalacao IN (SELECT id_instalacao FROM ins))),
            med AS (SELECT id_registro FROM registro_sync WHERE entidade = 'Medicao' AND id_empresa = ?1 AND json_extract(dados, '$.id_instalacao') IN (SELECT id_instalacao FROM ins))
       SELECT 'Cliente:' || id_cliente AS chave FROM cli
       UNION ALL SELECT 'Instalacao:' || id_instalacao FROM ins
       UNION ALL SELECT 'Proposta:' || id_proposta FROM pro
       UNION ALL SELECT 'Medicao:' || id_registro FROM med
       UNION ALL SELECT 'SimulacaoSombreamento:' || id_registro FROM registro_sync
         WHERE entidade = 'SimulacaoSombreamento' AND id_empresa = ?1 AND json_extract(dados, '$.id_medicao') IN (SELECT id_registro FROM med)
       UNION ALL SELECT 'SolicitacaoUpgrade:' || id_registro FROM registro_sync
         WHERE entidade = 'SolicitacaoUpgrade' AND id_empresa = ?1 AND json_extract(dados, '$.id_usuario_solicitante') = ?2`,
      usuario.idEmpresa,
      usuario.idUsuario,
    );
    return new Set(linhas.map((l) => l.chave));
  }
}
