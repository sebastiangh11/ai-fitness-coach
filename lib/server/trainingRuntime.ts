import { SupabaseStore } from "../training-engine/runtime/stores/supabaseStore";
import { createTrainingRuntime } from "../training-engine/runtime/runtime";

export function getRuntime() {
  const store = new SupabaseStore();
  return createTrainingRuntime(store);
}
