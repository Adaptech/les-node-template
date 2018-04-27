import path from "path";
import levelup from "levelup";
import leveldown from "leveldown";

export function openDb(dbDir) {
  return levelup(leveldown(path.resolve(dbDir)));
}