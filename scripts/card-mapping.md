# Card Mapping — API → DB

Arquivo para alinhar o parser com a estrutura real da API.  
Corrija as seções marcadas com ❓ e retorne para eu ajustar o script.

---

## Estrutura da referência

```
ALT_EOLECB_A_AX_106_C
 ^    ^     ^ ^   ^  ^
 |    |     | |   |  └─ rarity suffix (C, R1, R2, E, U_XXXX)
 |    |     | |   └─── card number
 |    |     | └─────── faction (AX, BR, LY, MU, OR, YZ, NE)
 |    |     └───────── variant type (A, B, P — ❓ ver abaixo)
 |    └─────────────── set code
 └──────────────────── always "ALT"
```

---

## Campos do DB (Card / UniqueCard) × Campo da API

| DB field          | API field                        | Meu mapeamento atual           | Confiante? |
|-------------------|----------------------------------|-------------------------------|------------|
| `collection`      | `cardSet.reference`              | `"EOLECB"`                    | ✅          |
| `collectionNumber`| `cardFamilyReference`            | número extraído de `"AX_106"` → `106` | ✅ |
| `rarity`          | `rarity.reference`               | `COMMON`→`C`, `RARE`→`R`, `UNIQUE`→`U`, `EXALTED`→`E` | ✅ |
| `name`            | `name`                           | `"Sneaky Salamander"`         | ✅          |
| `faction`         | `mainFaction.reference`          | `"AX"`                        | ✅          |
| `type`            | `cardType.reference`             | `CHARACTER`→`Character`, `HERO`→`Hero`, `SPELL`→`Spell`, `PERMANENT`→`Permanent` | ✅ |
| `mainCost`        | `elements.MAIN_COST`             | parseInt                      | ✅          |
| `recallCost`      | `elements.RECALL_COST`           | parseInt                      | ✅          |
| `forestPower`     | `elements.FOREST_POWER`          | parseInt                      | ✅          |
| `mountainPower`   | `elements.MOUNTAIN_POWER`        | parseInt                      | ✅          |
| `oceanPower`      | `elements.OCEAN_POWER`           | parseInt                      | ✅          |
| `mainEffect`      | ❓ não encontrado em `elements`   | `null` (sem mapeamento)       | ❌          |
| `echoEffect`      | ❓ não encontrado em `elements`   | `null` (sem mapeamento)       | ❌          |
| `variants`        | `allImagePath` + `reference`     | ❓ ver seção abaixo            | ❌          |
| `uniqueId`        | extraído do `reference`          | `"ALT_EOLE_B_AX_106_U_4244"` → `4244` | ✅ |

---

## Dúvidas / Incertezas ❓

### 1. Variant type na referência (A, B, P) — RESOLVIDO
```
ALT_EOLECB_A_AX_106_C  ← "A"
ALT_CORE_B_AX_01_C     ← "B"
ALT_WCF25_P_AX_01_C    ← "P"
```
Regras definidas e implementadas em `import-variants.ts`:

| Tipo | Significado | Comportamento |
|------|-------------|---------------|
| `B`  | Base/standard | Card próprio no DB. **Pulado** pelo import-variants — exceto sets mapeados em `ALTERNATE_SET_TO_BASE` (ex: COREKS → CORE) |
| `P`  | Promo | **Variante** da carta B com mesma collection/number/faction/rarity. Linkada via array `variants` |
| `A`  | Alternate art | Mesmo tratamento do P — variante da carta B correspondente |

**Exemplos:**
```
ALT_CORE_B_BR_01_C   → carta base no DB (collection=CORE, num=1, faction=BR, rarity=C)
ALT_CORE_P_BR_01_C   → variante promo da carta acima (mesmo rarity=C)
ALT_CORE_P_BR_01_R1  → variante promo da carta CORE/1/BR/R (rarity=R, não C!)
ALT_COREKS_B_AX_04_R1 → variante art alternativa de CORE/4/AX/R (COREKS → CORE)
```

---

### 2. Sufixo de raridade R1 vs R2
```
ALT_CORE_B_AX_02_R1   ← rarity.reference = "RARE"
ALT_CORE_B_AX_02_R2   ← rarity.reference = "RARE"
```
Ambos têm `rarity.reference = "RARE"`, mas sufixos diferentes.

- R1 = arte padrão rara?
- R2 = arte alternativa/foil?

**Impacto:** atualmente coloco R2 como `isCollectorArt: true` no array `variants`. Correto?

---

### 3. Texto de efeito (mainEffect / echoEffect)
Os campos `MAIN_EFFECT` e `ECHO_EFFECT` **não aparecem** em `elements` nas cartas testadas.

Existem outros campos ou endpoints para obter o texto das habilidades?
Exemplo: `"Sneaky Salamander"` — qual é o efeito desta carta?

---

### 4. Carta Unique tem faction diferente da família — RESOLVIDO

Sim, é intencional. Unique cards são cross-faction por design. A `mainFaction` da Unique pode ser diferente da família base. Por isso, buscamos uniques por CADA fação separadamente.

---

### 5. isCollectorArt — RESOLVIDO

Regra aplicada:
- Cartas do tipo B de coleções normais (CORE, ALIZE, etc.) → `isCollectorArt: false`
- Cartas do tipo P, A e COREKS → `isCollectorArt: true`

---

## Exemplos de parse esperado

### Exemplo 1 — Carta comum (COMMON, CHARACTER)

**Raw API:**
```json
{
  "reference": "ALT_EOLECB_A_AX_106_C",
  "name": "Sneaky Salamander",
  "cardType": { "reference": "CHARACTER" },
  "cardSet": { "reference": "EOLECB" },
  "cardFamilyReference": "AX_106",
  "rarity": { "reference": "COMMON" },
  "mainFaction": { "reference": "AX" },
  "elements": { "MAIN_COST": "1", "RECALL_COST": "1", "MOUNTAIN_POWER": "1", "OCEAN_POWER": "0", "FOREST_POWER": "1" },
  "allImagePath": { "en-us": "https://...jpg" }
}
```

**DB Card esperado:**
```json
{
  "collection": "EOLECB",
  "collectionNumber": 106,
  "rarity": "C",
  "name": "Sneaky Salamander",
  "faction": "AX",
  "type": "Character",
  "mainCost": 1,
  "recallCost": 1,
  "forestPower": 1,
  "mountainPower": 1,
  "oceanPower": 0,
  "mainEffect": null,
  "echoEffect": null,
  "variants": [
    { "variantId": "ALT_EOLECB_A_AX_106_C", "language": "en", "imageUrl": "https://...jpg", "isCollectorArt": false }
  ]
}
```

---

### Exemplo 2 — Herói (HERO, COMMON)

**Raw API:**
```json
{
  "reference": "ALT_CORE_B_AX_01_C",
  "name": "Sierra & Oddball",
  "cardType": { "reference": "HERO" },
  "cardSet": { "reference": "CORE" },
  "cardFamilyReference": "AX_01",
  "rarity": { "reference": "COMMON" },
  "mainFaction": { "reference": "AX" },
  "elements": { "MAIN_COST": "0", "RECALL_COST": "0", "MOUNTAIN_POWER": "0", "OCEAN_POWER": "0", "FOREST_POWER": "0" },
  "assets": {
    "HERO_WIDE": ["https://...ALTERATOR_WIDE.jpg", "https://...HERO_WIDE.jpg"],
    "HERO_THUMB": ["https://...HERO_THUMB.jpg"],
    "WEB": ["https://...WEB.jpg"]
  },
  "allImagePath": { "en-us": "https://...jpg" }
}
```

**DB Card esperado:**
```json
{
  "collection": "CORE",
  "collectionNumber": 1,
  "rarity": "C",
  "name": "Sierra & Oddball",
  "faction": "AX",
  "type": "Hero",
  "mainCost": 0,
  "recallCost": 0,
  "forestPower": 0,
  "mountainPower": 0,
  "oceanPower": 0,
  "variants": [
    { "variantId": "ALT_CORE_B_AX_01_C", "language": "en", "imageUrl": "https://...jpg", "isCollectorArt": false }
  ]
}
```
❓ Para heróis, `allImagePath` ou `assets.HERO_WIDE` é a imagem principal?

---

### Exemplo 3 — Unique (UNIQUE, CHARACTER)

**Raw API:**
```json
{
  "reference": "ALT_EOLE_B_AX_106_U_4244",
  "name": "Sneaky Salamander",
  "cardType": { "reference": "CHARACTER" },
  "cardSet": { "reference": "EOLE" },
  "cardFamilyReference": "AX_106",
  "rarity": { "reference": "UNIQUE" },
  "mainFaction": { "reference": "LY" },
  "elements": { "MAIN_COST": "3", "RECALL_COST": "3", "MOUNTAIN_POWER": "1", "OCEAN_POWER": "2", "FOREST_POWER": "2" },
  "allImagePath": { "en-us": "https://...UNIQUE/JPG/en_US/....jpg" }
}
```

**DB UniqueCard esperado:**
```json
{
  "collection": "EOLE",
  "collectionNumber": 106,
  "uniqueId": 4244,
  "rarity": "U",
  "name": "Sneaky Salamander",
  "faction": "LY",
  "type": "Character",
  "mainCost": 3,
  "recallCost": 3,
  "forestPower": 2,
  "mountainPower": 1,
  "oceanPower": 2,
  "variants": [
    { "variantId": "ALT_EOLE_B_AX_106_U_4244", "language": "en", "imageUrl": "https://...jpg", "isCollectorArt": false }
  ]
}
```

---

## Importação de Unique Cards

### Estratégia de busca

A API retorna no máximo 1000 resultados por query. Como cada carta pode ter uniques em múltiplas fações, a busca é feita **por fação**:

1. Para cada `(collection, collectionNumber)` no banco que tenha cartas R ou F:
   - Pegar a fação do card R → usar como referência da query (ex: `ALT_BISE_B_LY_49_R1`)
   - Coletar todas as fações distintas do grupo (R e F podem ter fações diferentes)
2. Para cada fação do grupo, fazer uma query separada:
   ```
   GET /cards?factions[]={faction}&query={R1_ref}&rarity[]=UNIQUE&itemsPerPage=1000
   ```
3. Resultado: até 1000 uniques por fação × 2 fações = até 2000 uniques por família

### Estrutura da referência Unique

```
ALT_BISE_B_LY_49_U_5159
 ^    ^    ^ ^   ^  ^  ^
 |    |    | |   |  |  └─ uniqueId (instância individual)
 |    |    | |   |  └─── rarity = "U"
 |    |    | |   └────── collectionNumber
 |    |    | └────────── faction (pode diferir da carta base)
 |    |    └──────────── cardVariantType = "B"
 |    └───────────────── collection
 └────────────────────── "ALT"
```

### Campos de status

Unique cards podem ter status mutáveis — sempre atualizar no upsert:
- `isSuspended`: carta suspensa temporariamente
- `isErrated`: regras da carta foram erratadas
- `isBanned`: carta banida do formato

### Escala dos dados

- 110 famílias (collection + collectionNumber) com R/F no banco
- ~630 queries API no total (110 × ~5.7 fações médias)
- ~1000 uniques por query → ~630.000 unique cards no total

---

## Rate Limiting da API (Cloudflare)

### Comportamento observado (2026-04-06)

- **Limite:** ~25-30 requests por janela de ~30s
- **Erro:** HTTP 429, Cloudflare Error 1015
- **retry_after header:** 30s (mas recuperação real pode levar vários minutos após burst)
- **Bloqueio prolongado:** acumular muitas requisições consecutivas leva a bloqueio de ~5-10 min mesmo após esperar o retry_after

### Configuração atual do script

- `itemsPerPage=1000` → 1 request por query (vs 10 com 108/página)
- 30s de delay entre queries
- Retry com backoff exponencial em caso de 429

### Tempo estimado de importação completa

~5.25 horas (630 queries × 30s), sem interrupções.

### Recomendação ao re-executar

Se houver erros de rate limit em série (575+ erros), aguardar **30 minutos** antes de rodar novamente. O script é idempotente — re-executar não duplica dados.

---

## Bugs conhecidos / corrigidos

### Zero-padding no `collectionNumber` ao construir a referência da API

**Arquivo:** `scripts/import-variants.ts`  
**Descoberto em:** 2026-04-06  
**Status:** ✅ Corrigido

**Problema:**  
O `collectionNumber` é armazenado no banco como inteiro (ex: `4`). Ao construir a referência para chamar o endpoint `/cards/{reference}/variants`, o script gerava:

```
ALT_CORE_B_AX_4_C   ← gerado pelo script (errado)
ALT_CORE_B_AX_04_C  ← formato real da API (correto)
```

A API retornava **404** silencioso (capturado como `[]` no código), então cards com `collectionNumber` de 1 dígito (1–9) nunca tinham suas variantes importadas. Nenhum erro era registrado.

**Causa raiz:**  
Template literal sem zero-padding:
```typescript
// antes (bugado)
const baseRef = `ALT_${cCard.collection}_B_${cCard.faction}_${cCard.collectionNumber}_C`

// depois (corrigido)
const num = String(cCard.collectionNumber).padStart(2, "0")
const baseRef = `ALT_${cCard.collection}_B_${cCard.faction}_${num}_C`
```

**Impacto:**  
Cards com número 1–9 em qualquer coleção não tinham variantes P/A importadas. Ex: `ALT_DUSTERTOP_P_AX_04_C` não era salva como variante de `CORE/4/AX/C`.

---

## Arquivo de dados brutos

- `scripts/api-sample.json` — 10 cartas da rota padrão (EOLECB set)
- `scripts/api-sample-extras.json` — 1 hero (CORE) + 1 unique (EOLE)
