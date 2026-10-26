import { openDatabase } from "../src/server/db/connection";
const store = openDatabase(process.env.DATABASE_PATH ?? "./data/planner.db");
store.sqlite.close();
console.log("Migrations applied.");
