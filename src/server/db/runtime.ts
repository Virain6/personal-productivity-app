import "server-only";
import { openDatabase } from "./connection";
import { seed } from "../services/scheduling";
const globalStore = globalThis as unknown as {
  plannerStore?: ReturnType<typeof openDatabase>;
};
export function getStore() {
  if (!globalStore.plannerStore) {
    const store = openDatabase(
      process.env.DATABASE_PATH ?? "./data/planner.db",
    );
    seed(store);
    globalStore.plannerStore = store;
  }
  return globalStore.plannerStore;
}
