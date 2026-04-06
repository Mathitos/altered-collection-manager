-- Fix: add faction to cards unique constraint
-- Card numbers repeat across factions (AX, BR, LY, MU, OR, YZ each have their own 1..N)

DROP INDEX IF EXISTS "cards_collection_collectionNumber_rarity_key";

CREATE UNIQUE INDEX IF NOT EXISTS "cards_collection_collectionNumber_faction_rarity_key"
  ON "cards"("collection", "collectionNumber", "faction", "rarity");
