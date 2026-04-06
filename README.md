# Altered TCG Collection Manager

Catálogo e construtor de decks para o Altered TCG. Preserva o acervo de cartas e permite montar decks com validação das regras do formato Standard.

## Features

- Catálogo completo de cartas com busca e filtros (fação, tipo, raridade, coleção)
- Construtor de decks com validação em tempo real
- Compartilhamento de decks via link público
- Autenticação com Google

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (App Router) + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| ORM | Prisma 7 |
| Banco | PostgreSQL via Supabase |
| Auth | NextAuth.js v5 + Google |
| Hosting | Vercel |

## Setup local

### Pré-requisitos

- [Bun](https://bun.sh/) 1.x
- Conta no [Supabase](https://supabase.com/) (PostgreSQL)
- Projeto no [Google Cloud Console](https://console.cloud.google.com/) com OAuth 2.0

### 1. Clonar e instalar

```bash
git clone https://github.com/Mathitos/altered-collection-manager.git
cd altered-collection-manager/src
bun install
```

### 2. Variáveis de ambiente

Crie o arquivo `src/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
AUTH_SECRET="gere com: bun -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
AUTH_GOOGLE_ID="seu-google-client-id"
AUTH_GOOGLE_SECRET="seu-google-client-secret"
AUTH_TRUST_HOST=true
```

> **Atenção:** Caracteres especiais na senha devem ser URL-encoded (`%` → `%25`, `!` → `%21`, `*` → `%2A`, `&` → `%26`).

### 3. Banco de dados

Como o Prisma 7 usa adaptador direto (sem pgBouncer), use o **Session Pooler** do Supabase (porta 5432).

Para criar as tabelas, execute o SQL gerado:

```bash
bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Cole o output no **SQL Editor** do Supabase e execute.

### 4. Rodar

```bash
bun run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Importar cartas

### Via API oficial do Altered TCG

```bash
bun run import:cards
# Com locale específico:
bun run import:cards --locale=pt-br
# Dry run (sem escrever no DB):
bun run import:cards --dry-run
```

### Via CSV

```bash
curl -X POST http://localhost:3000/api/admin/import \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -F "file=@cards.csv"
```

Formato do CSV: `collection, collection_number, rarity, name, faction, type, main_cost, recall_cost, forest_power, mountain_power, ocean_power, ability_text, support_text, flavor_text, translations (JSON), variants (JSON), unique_id`.

### Seed de exemplo

```bash
bun run db:seed
```

## Testes

```bash
bun test
```

## Deploy (Vercel)

1. Importe o repositório no Vercel
2. Configure o **Root Directory** como `src`
3. Adicione as variáveis de ambiente no painel da Vercel
4. O build script já inclui `prisma generate`:
   ```json
   "build": "prisma generate && next build"
   ```

## Google OAuth

No [Google Cloud Console](https://console.cloud.google.com/):

- **Authorized JavaScript origins:** `http://localhost:3000`, `https://seu-app.vercel.app`
- **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`, `https://seu-app.vercel.app/api/auth/callback/google`

## Regras de validação de deck (Standard)

| Regra | Limite |
|---|---|
| Mínimo de cartas | 39 (excluindo Herói) |
| Cópias por nome | máx. 3 |
| Fação | mono-fação |
| Rares | máx. 15 |
| Uniques | máx. 3 |
