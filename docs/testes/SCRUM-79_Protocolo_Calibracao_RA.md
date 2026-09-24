**LUMINI** — **PROTOCOLO DE CALIBRAÇÃO DA MEDIÇÃO POR REALIDADE AUMENTADA (SCRUM-79)**

Versão 1.0 — 23 de setembro de 2026

# 1. Objetivo

Comparar a medição do telhado por Realidade Aumentada (RF04) com medidas manuais conhecidas **antes** de confiar na RA em campo real. É o critério de aceite do RF04 ("calibração contra medida manual conhecida") e o passo 4 da verificação do RNF09. O resultado define o campo `calibrada` da Medição do Telhado (Dicionário de Dados, 5.1).

# 2. Quando executar

- Antes do primeiro uso da RA em campo (Sprint Interna 5, junto com SCRUM-5/SCRUM-11).
- Em cada modelo de aparelho usado pela equipe — no mínimo 1 Android (ARCore) e 1 iOS (ARKit); de preferência um de cada faixa (topo, intermediário e entrada), como na matriz do SCRUM-107.
- De novo sempre que o módulo de RA mudar (nova versão do ViroReact ou mudança na forma de marcar os vértices).

# 3. Materiais

- Trena de 5 m ou medidor a laser (referência de comprimento).
- Fita crepe para marcar os cantos no piso.
- Um cômodo ou área retangular com cantos acessíveis — por exemplo, uma sala de aula de dimensões conhecidas.
- Para inclinação: uma prancha ou rampa apoiada com inclinação conhecida, medida com inclinômetro ou aplicativo de nível já conferido.
- Para orientação: uma parede cujo azimute seja conhecido (bússola de referência longe de metais, ou planta/imagem de satélite).
- O app com o modo de calibração e o arquivo `SCRUM-79_modelo_registro_calibracao.csv` desta pasta.

# 4. Procedimento

1. **Medir a referência.** Meça com a trena os dois lados do retângulo duas vezes e use a média. Calcule a área (comprimento × largura). Anote também a inclinação da prancha e o azimute da parede de referência.
2. **Marcar os cantos** do retângulo no piso com fita crepe.
3. **Medir com a RA.** No app, abra a medição por RA, aguarde a detecção do plano e toque nos 4 cantos marcados. Anote o comprimento dos lados, a área, a inclinação e a orientação exibidos.
4. **Repetir 5 vezes em cada aparelho**, fechando e abrindo a sessão de RA entre as repetições (novo rastreamento) e começando de posições diferentes (1 a 5 m de distância).
5. **Repetir para a inclinação** (prancha/rampa) e para a **orientação** (parede de referência).
6. **Registrar** cada medição em uma linha do CSV: `data;dispositivo;sistema;grandeza;referencia;medido;observacoes`, com `grandeza` igual a `comprimento`, `area`, `inclinacao` ou `azimute`. Use as observações para iluminação, textura do piso e perdas de rastreamento.
7. **Gerar o relatório:**

   ```bash
   npm run calibracao -w @lumini/domain -- --arquivo registro.csv --saida relatorio-calibracao.md
   ```

   O relatório mostra, por aparelho e grandeza, a média, o desvio padrão (repetibilidade), o viés (erro sistemático), o erro máximo e se o resultado foi aprovado.

# 5. Critérios de aceitação

| Grandeza | Tolerância (cada medição) | Justificativa |
|---|---|---|
| Comprimento | ±3 % | Precisão típica de ARKit/ARCore a poucos metros, com boa iluminação |
| Área | ±5 % | O erro relativo da área é aproximadamente a soma dos erros dos dois lados |
| Inclinação | ±2° | Suficiente para o cálculo de sombreamento e da geração |
| Orientação (azimute) | ±10° | A bússola do celular sofre interferência; ±10° mantém a orientação cardinal correta na maioria dos casos |

- Uma grandeza é **aprovada** quando **todas** as medições dela ficam dentro da tolerância.
- O aparelho é **calibrado** quando todas as grandezas testadas são aprovadas. Nesse caso, as medições feitas nele por RA recebem `calibrada = true`.
- Se houver **viés sistemático** (por exemplo, a RA mede sempre 4 % a mais), o relatório sugere um **fator de correção**. Ele só deve ser adotado com decisão da equipe e com um novo teste confirmando a aprovação.
- Aparelho reprovado: a medição nele deve usar o **Modo Leve** (RF05/RF19) até uma nova calibração.

As tolerâncias são uma proposta da equipe e podem ser ajustadas com o professor da unidade de RA. Elas ficam em `packages/domain/src/medicao/calibracao.ts` (`TOLERANCIAS_PADRAO`).

# 6. Evidências a guardar

- Fotos da trena/medidor nas medidas de referência e do cômodo com os cantos marcados.
- Capturas de tela do app em cada medição.
- O CSV preenchido e o relatório gerado.
- Modelo e sistema de cada aparelho testado.

# 7. Como o app usa o resultado

- A geometria da RA fica em `packages/domain/src/medicao/geometria3d.ts`: a partir dos vértices marcados na cena (metros, eixo Y para cima) e do rumo da bússola no início da sessão, `medirPoligono` calcula a área no plano inclinado, a inclinação, o azimute e a orientação (N, NE, L…), e indica o **desvio de planaridade** (vértices marcados fora do plano).
- `avaliarCalibracao` e `consolidarCalibracao` (em `calibracao.ts`) fazem a análise do teste; um modo de calibração dentro do app pode usar as mesmas funções.

# 8. Cuidados

- Boa iluminação e superfície com textura ajudam a detecção de planos; evite pisos espelhados ou totalmente lisos.
- Movimente o aparelho devagar ao iniciar a sessão.
- **Segurança:** o teste deve ser feito no chão. Medições de conferência em telhados reais exigem os procedimentos de trabalho em altura (NR-35) e não fazem parte deste protocolo.
- Limitação conhecida: o teste no piso valida distâncias e áreas; em campo, a distância até o telhado costuma ser maior, o que tende a aumentar o erro. Por isso a medição de campo continua podendo ser conferida pelo Modo Leve.
