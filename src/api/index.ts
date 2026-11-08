import type { Api } from "./types";
import { createLocalApi } from "./local";
import { createSupabaseApi } from "./supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Uses Supabase when its env vars are set; otherwise a demo backend stored in the browser. */
export const api: Api = url && key ? createSupabaseApi(url, key) : createLocalApi();

export { ApiError } from "./types";
export type { Api } from "./types";
