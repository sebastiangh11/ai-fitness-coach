import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseStore } from "../training-engine/runtime/stores/supabaseStore";
import { createTrainingRuntime } from "../training-engine/runtime/runtime";

export function getRuntime(client: SupabaseClient) {
  const store = new SupabaseStore(client);
  return createTrainingRuntime(store);
}
