#!/bin/bash
# ============================================================
# Lumini - Script de Criação da Estrutura de Pastas
# Arquitetura: Clean Architecture + Feature-based Routing
# Stack: React Native + SQLite + ViroReact (AR)
# ============================================================

set -e

echo "🌞 Lumini — Criando estrutura de pastas do projeto..."

# ── src/app — Configurações globais e inicialização ──
mkdir -p src/app/navigation
mkdir -p src/app/providers
mkdir -p src/app/config
mkdir -p src/app/database

# ── src/features — Módulos isolados por funcionalidade ──
for feature in orcamento clientes configuracoes dashboard; do
  mkdir -p src/features/$feature/screens
  mkdir -p src/features/$feature/components
  mkdir -p src/features/$feature/hooks
  mkdir -p src/features/$feature/services
  mkdir -p src/features/$feature/types
done

# ── src/domain — Camada de domínio (Clean Architecture) ──
mkdir -p src/domain/entities
mkdir -p src/domain/interfaces
mkdir -p src/domain/enums
mkdir -p src/domain/value-objects

# ── src/data — Camada de infraestrutura e persistência ──
mkdir -p src/data/repositories
mkdir -p src/data/datasources/local
mkdir -p src/data/datasources/remote
mkdir -p src/data/database/migrations
mkdir -p src/data/database/schemas
mkdir -p src/data/sync
mkdir -p src/data/mappers

# ── src/viro — Módulo de Realidade Aumentada ──
mkdir -p src/viro/scenes
mkdir -p src/viro/components
mkdir -p src/viro/hooks
mkdir -p src/viro/utils
mkdir -p src/viro/models

# ── src/components — Componentes visuais reutilizáveis ──
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/components/feedback
mkdir -p src/components/forms

# ── src/assets — Arquivos estáticos ──
mkdir -p src/assets/images
mkdir -p src/assets/icons
mkdir -p src/assets/fonts
mkdir -p src/assets/models3d

# ── src/shared — Utilitários e tipos globais ──
mkdir -p src/shared/utils
mkdir -p src/shared/constants
mkdir -p src/shared/hooks
mkdir -p src/shared/types

echo "✅ Estrutura criada com sucesso!"
echo ""
echo "📁 Árvore gerada:"
find src -type d | sort | head -60
