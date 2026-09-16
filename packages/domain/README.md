# Lumini — `packages/domain`

Pacote TypeScript com as regras de cálculo compartilhadas entre o app mobile e o painel web — fonte única de verdade para dimensionamento, precificação e viabilidade. **A API não usa este pacote** (ela é apenas de sincronização e persistência).

## Escopo (tarefa NOVO-107 do backlog)

- Dimensionamento fotovoltaico (RN01: `kWp = Consumo / (HSP × 30 × (1 − Perdas))`)
- Cálculo de perdas (temperatura, sujeira, cabeamento, sombreamento)
- Precificação (RN03: equipamentos + materiais + mão de obra + ART + frete + margem − desconto)
- Viabilidade financeira e ambiental (payback, ROI, economia acumulada, CO₂ evitado)
- Simulação de sombreamento (sun path)
- Casos de teste de referência, para garantir que app e web nunca calculem valores diferentes

> Pacote ainda não implementado — esta pasta contém apenas este README como marcador da estrutura inicial (Sprint 1). Base do SCRUM-12 e do NOVO-81.
