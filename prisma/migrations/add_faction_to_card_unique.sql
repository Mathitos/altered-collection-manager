-- Migration: add faction to Card unique constraint
-- Run this in the Supabase SQL Editor

-- DropIndex
DROP INDEX "cards_collection_collectionNumber_rarity_key";

-- CreateIndex
CREATE UNIQUE INDEX "cards_collection_collectionNumber_faction_rarity_key" ON "cards"("collection", "collectionNumber", "faction", "rarity");
