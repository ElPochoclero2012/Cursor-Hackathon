import { allLots, aliasMap, allLocations, bodegas } from "./db";

export async function getCatalog() {
  return {
    locations: await allLocations(),
    bodegas: await bodegas(),
    lots: await allLots(),
    aliases: await aliasMap(),
  };
}
