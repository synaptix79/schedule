import { createClient } from "@supabase/supabase-js";
import { normalizeAppData } from "./storage";
import type { AppData } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const APP_STATE_ID = "house-os";
let appStateTableUnavailable = false;

function isMissingAppStateTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    Boolean(error.message?.includes("public.app_state"))
  );
}

export async function loadRemoteAppData(): Promise<AppData | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", APP_STATE_ID)
    .maybeSingle();

  if (error) {
    if (isMissingAppStateTable(error)) {
      appStateTableUnavailable = true;
      return null;
    }

    throw new Error(`No se pudo cargar Supabase: ${error.message}`);
  }

  appStateTableUnavailable = false;
  return data?.data ? normalizeAppData(data.data as Partial<AppData>) : null;
}

export async function saveRemoteAppData(data: AppData): Promise<void> {
  if (!supabase || appStateTableUnavailable) {
    return;
  }

  const { error } = await supabase.from("app_state").upsert({
    id: APP_STATE_ID,
    data,
    updated_at: new Date().toISOString()
  });

  if (error) {
    if (isMissingAppStateTable(error)) {
      appStateTableUnavailable = true;
      return;
    }

    throw new Error(`No se pudo guardar en Supabase: ${error.message}`);
  }
}
