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

### 1. Variant type na referência (A, B, P)
```
ALT_EOLECB_A_AX_106_C  ← "A"
ALT_CORE_B_AX_01_C     ← "B"
ALT_WCF25_P_AX_01_C    ← "P"
```
- `B` = base/standard?
- `A` = alternate art?
- `P` = promo?

**Impacto:** devo criar registros separados para A e B da mesma carta, ou agrupá-los como variantes?

Atualmente agrupo por `(cardSet, collectionNumber, rarity)`, então `ALT_EOLECB_A_AX_106_C` e `ALT_EOLECB_B_AX_106_C` (se existir) virariam 1 registro com 2 imagens no array `variants`. É isso mesmo?

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

### 4. Carta Unique tem faction diferente da família
```json
{
  "reference": "ALT_EOLE_B_AX_106_U_4244",
  "cardFamilyReference": "AX_106",
  "name": "Sneaky Salamander",
  "mainFaction": { "reference": "LY" }  ← LY, mas a família é AX_106!
}
```
A carta regular `AX_106` é fação `AX`, mas a Unique é fação `LY`.
Isso é intencional (Unique cross-faction)?

---

### 5. isCollectorArt — como identificar?
Atualmente uso `refSuffix === "R2"` para marcar como collector art.
Mas há casos como `ALT_COREKS_B_AX_*` que parece ser uma coleção inteira de arte alternativa.

Qual é a regra correta para `isCollectorArt`?

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
