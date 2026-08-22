import type { DatabaseSync } from "node:sqlite";
import { allLots, aliasMap, allLocations, bodegas, getDb } from "./db";

export function getCatalog(database = getDb()) {
  return {
    locations: allLocations(database),
    bodegas: bodegas(database),
    lots: allLots(database),
    aliases: aliasMap(database),
  };
}
