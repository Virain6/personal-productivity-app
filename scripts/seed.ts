import { openDatabase } from "../src/server/db/connection";
import { seed, ensureOccurrences } from "../src/server/services/scheduling";
import { addDays, localDate } from "../src/lib/dates";
const store = openDatabase(process.env.DATABASE_PATH ?? "./data/planner.db");
seed(store);
const today = localDate();
ensureOccurrences(store, today, addDays(today, 28));
store.sqlite.close();
console.log(
  "Defaults and rolling occurrences ready (existing data preserved).",
);
