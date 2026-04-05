import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  console.log("Seeding database...")

  type CardSeed = {
    collection: string
    collectionNumber: number
    rarity: string
    name: string
    faction: string
    type: string
    mainCost?: number | null
    recallCost?: number | null
    forestPower?: number | null
    mountainPower?: number | null
    oceanPower?: number | null
    abilityText?: string | null
    supportText?: string | null
    flavorText?: string | null
    translations?: object
    variants?: object[]
  }

  const cards: CardSeed[] = [
    // Faction: AX (Axiom) — Hero
    {
      collection: "BTG",
      collectionNumber: 1,
      rarity: "C",
      name: "Aelis, Rift Exorcist",
      faction: "AX",
      type: "Hero",
      forestPower: 2,
      mountainPower: 1,
      oceanPower: 3,
      abilityText: "When Aelis enters the field, you may exile a card from any graveyard.",
      flavorText: "She walks between worlds.",
      translations: { pt: { name: "Aelis, Exorcista do Rifto", abilityText: "Quando Aelis entra em campo, você pode exilar uma carta de qualquer cemitério.", flavorText: "Ela caminha entre mundos." } },
      variants: [{ variantId: "BTG_AX_001_C_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_AX_001_C_EN.jpg", artist: "John Doe", isCollectorArt: false }],
    },
    // AX Commons
    {
      collection: "BTG",
      collectionNumber: 2,
      rarity: "C",
      name: "Arcane Barrier",
      faction: "AX",
      type: "Spell",
      mainCost: 2,
      recallCost: 1,
      forestPower: 0,
      mountainPower: 1,
      oceanPower: 2,
      abilityText: "Negate target spell. Draw a card.",
      supportText: "Counter a spell. Draw a card.",
      flavorText: "Knowledge is the ultimate shield.",
      translations: { pt: { name: "Barreira Arcana", abilityText: "Negue um feitiço alvo. Compre uma carta.", supportText: "Contere um feitiço. Compre uma carta.", flavorText: "O conhecimento é o escudo supremo." } },
      variants: [{ variantId: "BTG_AX_002_C_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_AX_002_C_EN.jpg", artist: "Jane Smith", isCollectorArt: false }],
    },
    {
      collection: "BTG",
      collectionNumber: 3,
      rarity: "C",
      name: "Axiom Scout",
      faction: "AX",
      type: "Character",
      mainCost: 1,
      recallCost: 1,
      forestPower: 1,
      mountainPower: 0,
      oceanPower: 1,
      abilityText: "When Axiom Scout enters the field, scry 1.",
      variants: [{ variantId: "BTG_AX_003_C_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_AX_003_C_EN.jpg", artist: "Bob Lee", isCollectorArt: false }],
    },
    // AX Rare
    {
      collection: "BTG",
      collectionNumber: 4,
      rarity: "R",
      name: "Temporal Rift",
      faction: "AX",
      type: "Spell",
      mainCost: 4,
      recallCost: 2,
      forestPower: 1,
      mountainPower: 2,
      oceanPower: 3,
      abilityText: "Take an extra turn after this one. Exile Temporal Rift.",
      flavorText: "Time is just another resource.",
      translations: { pt: { name: "Fenda Temporal", abilityText: "Faça um turno extra após este. Exile Fenda Temporal.", flavorText: "O tempo é apenas mais um recurso." } },
      variants: [
        { variantId: "BTG_AX_004_R_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_AX_004_R_EN.jpg", artist: "Alice Chen", isCollectorArt: false },
        { variantId: "BTG_AX_004_R_EN_FOIL", language: "en", imageUrl: "https://altered.gg/cards/BTG_AX_004_R_EN_FOIL.jpg", artist: "Alice Chen", isCollectorArt: true },
      ],
    },
    // Faction: BR (Bravos) — Hero
    {
      collection: "BTG",
      collectionNumber: 10,
      rarity: "C",
      name: "Sigismar the Unbreakable",
      faction: "BR",
      type: "Hero",
      forestPower: 3,
      mountainPower: 3,
      oceanPower: 1,
      abilityText: "Sigismar has +1/+1 for each other Bravos Character you control.",
      flavorText: "He has never lost a fight.",
      translations: { pt: { name: "Sigismar, o Inquebrantável", abilityText: "Sigismar tem +1/+1 para cada outro Personagem Bravos que você controla.", flavorText: "Ele nunca perdeu uma luta." } },
      variants: [{ variantId: "BTG_BR_010_C_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_BR_010_C_EN.jpg", artist: "Marco Silva", isCollectorArt: false }],
    },
    {
      collection: "BTG",
      collectionNumber: 11,
      rarity: "C",
      name: "Battle Cry",
      faction: "BR",
      type: "Spell",
      mainCost: 2,
      recallCost: 1,
      forestPower: 2,
      mountainPower: 3,
      oceanPower: 0,
      abilityText: "All your Characters get +2/+0 until end of turn.",
      supportText: "All Characters you control get +2/+0.",
      flavorText: "The roar of Bravos shakes the mountains.",
      translations: { pt: { name: "Grito de Batalha", abilityText: "Todos os seus Personagens ganham +2/+0 até o final do turno.", supportText: "Todos os Personagens que você controla ganham +2/+0.", flavorText: "O rugido dos Bravos sacode as montanhas." } },
      variants: [{ variantId: "BTG_BR_011_C_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_BR_011_C_EN.jpg", artist: "Carlos Ruiz", isCollectorArt: false }],
    },
    {
      collection: "BTG",
      collectionNumber: 12,
      rarity: "C",
      name: "Iron Guard",
      faction: "BR",
      type: "Character",
      mainCost: 3,
      recallCost: 2,
      forestPower: 2,
      mountainPower: 4,
      oceanPower: 1,
      abilityText: "Taunt. Other friendly Characters take 1 less damage.",
      variants: [{ variantId: "BTG_BR_012_C_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_BR_012_C_EN.jpg", artist: "Lena Park", isCollectorArt: false }],
    },
    {
      collection: "BTG",
      collectionNumber: 13,
      rarity: "R",
      name: "Mountain Titan",
      faction: "BR",
      type: "Character",
      mainCost: 6,
      recallCost: 3,
      forestPower: 4,
      mountainPower: 6,
      oceanPower: 2,
      abilityText: "When Mountain Titan attacks, deal 2 damage to each enemy Character.",
      flavorText: "The earth trembles at his passing.",
      translations: { pt: { name: "Titã da Montanha", abilityText: "Quando o Titã da Montanha ataca, cause 2 de dano a cada Personagem inimigo.", flavorText: "A terra treme com sua passagem." } },
      variants: [{ variantId: "BTG_BR_013_R_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_BR_013_R_EN.jpg", artist: "Yuki Tanaka", isCollectorArt: false }],
    },
  ]

  for (const card of cards) {
    await prisma.card.upsert({
      where: {
        collection_collectionNumber_rarity: {
          collection: card.collection,
          collectionNumber: card.collectionNumber,
          rarity: card.rarity,
        },
      },
      update: {
        name: card.name,
        faction: card.faction,
        type: card.type,
        mainCost: card.mainCost,
        recallCost: card.recallCost,
        forestPower: card.forestPower,
        mountainPower: card.mountainPower,
        oceanPower: card.oceanPower,
        abilityText: card.abilityText,
        supportText: card.supportText,
        flavorText: card.flavorText,
        ...(card.translations !== undefined && { translations: card.translations }),
        ...(card.variants !== undefined && { variants: card.variants }),
      },
      create: {
        collection: card.collection,
        collectionNumber: card.collectionNumber,
        rarity: card.rarity,
        name: card.name,
        faction: card.faction,
        type: card.type,
        mainCost: card.mainCost,
        recallCost: card.recallCost,
        forestPower: card.forestPower,
        mountainPower: card.mountainPower,
        oceanPower: card.oceanPower,
        abilityText: card.abilityText,
        supportText: card.supportText,
        flavorText: card.flavorText,
        ...(card.translations !== undefined && { translations: card.translations }),
        ...(card.variants !== undefined && { variants: card.variants }),
      },
    })
  }

  // Sample unique card
  await prisma.uniqueCard.upsert({
    where: {
      collection_collectionNumber_uniqueId: {
        collection: "BTG",
        collectionNumber: 5,
        uniqueId: 1001,
      },
    },
    update: {},
    create: {
      collection: "BTG",
      collectionNumber: 5,
      uniqueId: 1001,
      rarity: "U",
      faction: "AX",
      type: "Character",
      mainCost: 3,
      recallCost: 2,
      forestPower: 2,
      mountainPower: 1,
      oceanPower: 3,
      name: "Mira the Seeker",
      abilityText: "Unique. When Mira enters the field, search your deck for a Spell and put it in your hand.",
      flavorText: "Her quest is eternal.",
      translations: { pt: { name: "Mira, a Buscadora", abilityText: "Único. Quando Mira entra em campo, procure em seu deck por um Feitiço e coloque-o na sua mão.", flavorText: "Sua busca é eterna." } },
      variants: [{ variantId: "BTG_AX_005_U_1001_EN", language: "en", imageUrl: "https://altered.gg/cards/BTG_AX_005_U_1001_EN.jpg", artist: "Emma White", isCollectorArt: false }],
    },
  })

  console.log(`Seeded ${cards.length} cards + 1 unique card.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
