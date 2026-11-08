import type { Api } from "./types";
import { createLocalApi } from "./local";
import { createSupabaseApi } from "./supabase";

const env = import.meta.env;
// VITE_* when set by hand; NEXT_PUBLIC_* when set by the Supabase–Vercel integration.
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Uses Supabase when its env vars are set; otherwise a demo backend stored in the browser. */
export const api: Api = url && key ? createSupabaseApi(url, key) : createLocalApi();

export { ApiError } from "./types";
export type { Api } from "./types";
