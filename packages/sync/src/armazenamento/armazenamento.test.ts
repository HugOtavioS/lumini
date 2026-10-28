import { describe, expect, it, vi } from 'vitest';
import { ErroValidacao } from '../erros';
import { capturarErro } from '../testes/registros';
import {
  MB,
  avaliarArmazenamento,
  confirmarPlano,
  executarLimpeza,
  formatarBytes,
  planejarLimpeza,
  verificarEspacoParaGravar,
  type PropostaArmazenada,
} from './politica';

const AGORA = '2026-10-18T12:00:00.000Z';
const diasAtras = (dias: number) => new Date(Date.parse(AGORA) - dias * 86_400_000).toISOString();

function proposta(id: string, dias: number, extra: Partial<PropostaArmazenada> = {}): PropostaArmazenada {
  return {
    idProposta: id,
    descricao: `Cliente ${id}`,
    statusProposta: 'Gerada',
    syncStatus: 'Sincronizado',
    temPendencia: false,
    atualizadoEm: diasAtras(dias),
    bytesArquivos: 2 * MB,
    ...extra,
  };
}

/** 200 propostas antigas (2 MB cada = 400 MB) + algumas recentes ou pendentes. */
function aparelhoCheio(): PropostaArmazenada[] {
  const antigas = Array.from({ length: 200 }, (_, i) => proposta(`antiga-${String(i).padStart(3, '0')}`, 100 + i));
  return [
    ...antigas,
    proposta('recente', 10),
    proposta('pendente', 200, { syncStatus: 'Pendente', temPendencia: true }),
    proposta('com-erro', 200, { syncStatus: 'Erro', temPendencia: true }),
    proposta('rascunho', 200, { statusProposta: 'Em elaboração', syncStatus: 'Pendente' }),
    proposta('reaberta', 200, { statusProposta: 'Reaberta' }),
  ];
}

describe('avaliarArmazenamento — SCRUM-87', () => {
  it('abaixo de 80 % do limite: tudo ok, sem aviso', () => {
    const r = avaliarArmazenamento({ propostas: [proposta('a', 100)], bytesBanco: 20 * MB, agora: AGORA });
    expect(r).toMatchObject({ nivel: 'ok', usoBytes: 22 * MB, limiteBytes: 500 * MB, avisoDestacado: false });
    expect(r.mensagem).toBe('O Lumini está usando 22 MB de 500 MB.');
  });

  it('a partir de 80 %: aviso discreto, já dizendo quanto dá para liberar', () => {
    const r = avaliarArmazenamento({ propostas: aparelhoCheio(), bytesBanco: 0, agora: AGORA });
    expect(r.usoBytes).toBe(410 * MB);
    expect(r).toMatchObject({ nivel: 'atencao', usoPerc: 82, avisoDestacado: false, qtdPropostasLiberaveis: 200, liberavelBytes: 400 * MB });
    expect(r.mensagem).toBe(
      'O Lumini está usando 410 MB de 500 MB (82%). Dá para liberar 400 MB removendo os arquivos de 200 propostas antigas ' +
        'que já estão no servidor. Elas continuam no histórico, e o PDF pode ser gerado de novo.',
    );
  });

  it('acima do limite: aviso destacado', () => {
    const r = avaliarArmazenamento({ propostas: aparelhoCheio(), bytesBanco: 95 * MB, agora: AGORA });
    expect(r).toMatchObject({ nivel: 'limite', avisoDestacado: true });
    expect(r.mensagem).toContain('o limite recomendado');
  });

  it('aparelho com menos de 300 MB livres: aviso crítico, mesmo com o Lumini ocupando pouco', () => {
    const r = avaliarArmazenamento({ propostas: [proposta('a', 5)], espacoLivreAparelhoBytes: 120 * MB, agora: AGORA });
    expect(r).toMatchObject({ nivel: 'critico', avisoDestacado: true });
    expect(r.mensagem).toContain('O celular está com pouco espaço livre (120 MB)');
  });

  it('com tudo pendente, explica que só dá para liberar o que já está no servidor', () => {
    const pendentes = Array.from({ length: 3 }, (_, i) => proposta(`p${i}`, 200, { syncStatus: 'Pendente', temPendencia: true, bytesArquivos: 150 * MB }));
    const r = avaliarArmazenamento({ propostas: pendentes, agora: AGORA });
    expect(r.nivel).toBe('atencao');
    expect(r.liberavelBytes).toBe(0);
    expect(r.mensagem).toContain('3 propostas estão pendentes de sincronização');
  });

  it('RNF14: o limite não bloqueia trabalho; só a falta real de espaço impede gravar o PDF', () => {
    // Lumini acima do limite, mas o celular tem espaço: pode gravar.
    expect(verificarEspacoParaGravar({ espacoLivreAparelhoBytes: 2_000 * MB, bytesNecessarios: 1 * MB })).toEqual({ pode: true, mensagem: null });
    // Celular sem espaço: não começa a gravar e diz o que fazer.
    const semEspaco = verificarEspacoParaGravar({ espacoLivreAparelhoBytes: 30 * MB, bytesNecessarios: 1 * MB });
    expect(semEspaco.pode).toBe(false);
    expect(semEspaco.mensagem).toBe(
      'Não há espaço livre suficiente para gerar o PDF agora (precisa de 51 MB, há 30 MB). A proposta já está salva: libere espaço e gere o PDF pelo histórico.',
    );
  });

  it('valida a política', () => {
    expect(() => avaliarArmazenamento({ propostas: [], politica: { limiteBytes: 0, avisoPerc: 120 } })).toThrow(ErroValidacao);
  });
});

describe('planejarLimpeza — SCRUM-87', () => {
  it('só entram propostas sincronizadas, sem pendência, fora de edição e sem alteração há mais de 90 dias', () => {
    const plano = planejarLimpeza({ propostas: aparelhoCheio(), agora: AGORA, gerarId: () => 'plano-1' });
    const ids = plano.itens.map((i) => i.idProposta);
    expect(ids).toHaveLength(200);
    for (const fora of ['recente', 'pendente', 'com-erro', 'rascunho', 'reaberta']) expect(ids).not.toContain(fora);
    expect(ids[0]).toBe('antiga-199'); // a mais antiga primeiro
    expect(plano.itens[0]?.motivo).toBe('sincronizada e sem alteração há 299 dias');
    expect(plano.totalBytes).toBe(400 * MB);
    expect(plano.resumo).toBe(
      'Remover o PDF e as imagens de 200 propostas libera 400 MB. Elas continuam no histórico e no servidor, e o PDF pode ser gerado de novo quando precisar. Deseja continuar?',
    );
  });

  it('propostas aprovadas ou recusadas podem sair depois de 30 dias', () => {
    const plano = planejarLimpeza({
      propostas: [proposta('aprovada', 45, { statusProposta: 'Aprovada' }), proposta('gerada', 45), proposta('recusada', 20, { statusProposta: 'Recusada' })],
      agora: AGORA,
    });
    expect(plano.itens.map((i) => [i.idProposta, i.motivo])).toEqual([['aprovada', 'aprovada e sem alteração há 45 dias']]);
  });

  it('com um alvo de espaço, para quando chega nele', () => {
    const plano = planejarLimpeza({ propostas: aparelhoCheio(), agora: AGORA, alvoBytes: 10 * MB });
    expect(plano.itens).toHaveLength(5);
    expect(plano.totalBytes).toBe(10 * MB);
  });

  it('sem candidatas, o plano vem vazio e diz isso', () => {
    const plano = planejarLimpeza({ propostas: [proposta('recente', 3)], agora: AGORA });
    expect(plano.itens).toEqual([]);
    expect(plano.resumo).toBe('Nenhuma proposta pode ter os arquivos removidos agora.');
  });
});

describe('executarLimpeza — nada é apagado sem aviso (SCRUM-87)', () => {
  const propostas = [proposta('a', 120), proposta('b', 110), proposta('c', 100)];

  it('sem a confirmação do técnico, não apaga nada', async () => {
    const plano = planejarLimpeza({ propostas, agora: AGORA });
    const removerArquivos = vi.fn(async () => undefined);
    const erro = await capturarErro<ErroValidacao>(executarLimpeza({ plano, confirmacao: null, propostasAtuais: propostas, removerArquivos }));
    expect(erro).toBeInstanceOf(ErroValidacao);
    expect(erro.message).toContain('Nada foi apagado');
    expect(removerArquivos).not.toHaveBeenCalled();
  });

  it('a confirmação vale só para a lista que o técnico viu', async () => {
    const plano = planejarLimpeza({ propostas, agora: AGORA, gerarId: () => 'plano-1' });
    const outro = planejarLimpeza({ propostas: propostas.slice(0, 1), agora: AGORA, gerarId: () => 'plano-1' });
    const removerArquivos = vi.fn(async () => undefined);
    await expect(executarLimpeza({ plano, confirmacao: confirmarPlano(outro), propostasAtuais: propostas, removerArquivos })).rejects.toThrow(ErroValidacao);
    expect(removerArquivos).not.toHaveBeenCalled();
  });

  it('com a confirmação, remove os arquivos e soma o espaço liberado', async () => {
    const plano = planejarLimpeza({ propostas, agora: AGORA });
    const removerArquivos = vi.fn(async (id: string) => (id === 'a' ? 3 * MB : undefined));
    const r = await executarLimpeza({ plano, confirmacao: confirmarPlano(plano, AGORA), propostasAtuais: propostas, removerArquivos, agora: AGORA });
    expect(r).toEqual({ removidas: ['a', 'b', 'c'], ignoradas: [], bytesLiberados: 3 * MB + 2 * MB + 2 * MB });
  });

  it('o que mudou depois da confirmação fica de fora, e uma falha não interrompe o resto', async () => {
    const plano = planejarLimpeza({ propostas, agora: AGORA });
    const confirmacao = confirmarPlano(plano, AGORA);
    const agora = [
      { ...propostas[0]!, statusProposta: 'Reaberta' as const }, // o gestor reabriu
      { ...propostas[1]!, atualizadoEm: diasAtras(0) }, // foi editada
      propostas[2]!,
    ];
    const removerArquivos = vi.fn(async () => {
      throw new Error('arquivo em uso');
    });
    const r = await executarLimpeza({ plano, confirmacao, propostasAtuais: agora.concat([]), removerArquivos, agora: AGORA });
    expect(r.removidas).toEqual([]);
    expect(r.ignoradas.map((i) => [i.idProposta, i.motivo])).toEqual([
      ['a', 'A proposta mudou depois da confirmação; os arquivos foram mantidos.'],
      ['b', 'A proposta mudou depois da confirmação; os arquivos foram mantidos.'],
      ['c', 'Não foi possível remover os arquivos: arquivo em uso'],
    ]);
    const sumiu = await executarLimpeza({ plano, confirmacao, propostasAtuais: [], removerArquivos, agora: AGORA });
    expect(sumiu.ignoradas[0]?.motivo).toBe('A proposta não está mais no aparelho.');
  });
});

describe('formatarBytes', () => {
  it('usa a unidade mais legível, com vírgula', () => {
    expect(formatarBytes(512)).toBe('512 bytes');
    expect(formatarBytes(850 * 1024)).toBe('850 KB');
    expect(formatarBytes(210 * MB)).toBe('210 MB');
    expect(formatarBytes(1.25 * 1024 * MB)).toBe('1,3 GB');
  });
});
