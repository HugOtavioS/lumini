/**
 * Gera a base de contingência de HSP (SCRUM-17) a partir do Atlas Brasileiro
 * de Energia Solar 2ª ed. (INPE/LABREN, 2017) e da lista de municípios do IBGE.
 *
 * Uso:
 *   npm run importar-atlas -w @lumini/domain -- \
 *     --atlas caminho/global_horizontal_means.csv \
 *     --municipios caminho/municipios.csv \
 *     --estados caminho/estados.csv \
 *     --saida caminho/contingencia-hsp.json
 *
 * - Atlas: https://labren.ccst.inpe.br/atlas_2017.html (arquivo de irradiação
 *   global horizontal, médias anual e mensais).
 * - Municípios/estados: https://github.com/kelvins/municipios-brasileiros (pasta csv).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gerarBaseContingencia, lerAtlasLabren, lerMunicipiosIbge } from '../src/hsp/importacaoAtlas';

function argumento(nome: string): string {
  const i = process.argv.indexOf(`--${nome}`);
  const valor = i >= 0 ? process.argv[i + 1] : undefined;
  if (!valor) {
    console.error(`Faltou o argumento --${nome}. Veja o cabeçalho de scripts/importar-atlas-labren.ts.`);
    process.exit(1);
  }
  return valor;
}

/** UUID determinístico (versão 5) a partir do código IBGE, para a carga ser repetível. */
function uuidDoCodigo(codigoIbge: string): string {
  const hash = createHash('sha1').update(`lumini:localidade:${codigoIbge}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const celulas = lerAtlasLabren(readFileSync(argumento('atlas'), 'utf8'));
const municipios = lerMunicipiosIbge(readFileSync(argumento('municipios'), 'utf8'), readFileSync(argumento('estados'), 'utf8'));
const base = gerarBaseContingencia(municipios, celulas, {
  dataAtualizacao: new Date().toISOString(),
  gerarId: uuidDoCodigo,
});

writeFileSync(argumento('saida'), `${JSON.stringify(base, null, 1)}\n`, 'utf8');
console.log(`${celulas.length} células do Atlas, ${municipios.length} municípios → ${base.length} localidades gravadas.`);
const idsGerados = new Set(base.map((l) => l.idLocalidade));
const semCelula = municipios.filter((m) => !idsGerados.has(uuidDoCodigo(m.codigoIbge)));
if (semCelula.length > 0) {
  // Ex.: ilhas oceânicas fora da grade do Atlas. Sem registro, o app usa a média do estado (RF08 2b).
  console.log(`Sem célula do Atlas a até 0,5°: ${semCelula.map((m) => `${m.nome}-${m.uf}`).join(', ')}`);
}
