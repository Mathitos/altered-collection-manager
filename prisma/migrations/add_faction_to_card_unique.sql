-- REVERT: restore original unique constraint (faction was incorrectly added)
-- Run this in the Supabase SQL Editor if the previous migration was applied.

DROP INDEX IF EXISTS "cards_collection_collectionNumber_faction_rarity_key";

CREATE UNIQUE INDEX IF NOT EXISTS "cards_collection_collectionNumber_rarity_key"
  ON "cards"("collection", "collectionNumber", "rarity");
