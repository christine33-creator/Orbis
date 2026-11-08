import type { Api } from "./types";
import { ApiError } from "./types";
import { createLocalApi } from "./local";
import { createSupabaseApi } from "./supabase";

const env = import.meta.env;
// VITE_* when set by hand; NEXT_PUBLIC_* when set by the Supabase–Vercel integration.
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * The browser-only demo backend is used ONLY when asked for explicitly (VITE_DEMO_MODE=1,
 * or a demo-persona build) or during local development. A production build without
 * Supabase settings must not silently store people's data in their browser.
 */
const demoAllowed = env.VITE_DEMO_MODE === "1" || !!env.VITE_DEMO_PERSONA || env.DEV;

export type BackendStatus = "supabase" | "demo" | "missing";
export const backendStatus: BackendStatus = url && key ? "supabase" : demoAllowed ? "demo" : "missing";

/** Every call fails; the app shows a configuration error before any of these can run. */
function createUnconfiguredApi(): Api {
  return new Proxy({ mode: "local" } as Api, {
    get(target, prop) {
      if (prop === "mode") return target.mode;
      if (prop === "onAuthChange" || prop === "onPasswordRecovery") return () => () => undefined;
      return () => Promise.reject(new ApiError("generic"));
    },
  });
}

export const api: Api =
  backendStatus === "supabase" ? createSupabaseApi(url!, key!) : backendStatus === "demo" ? createLocalApi() : createUnconfiguredApi();

export { ApiError } from "./types";
export type { Api } from "./types";
