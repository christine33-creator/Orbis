/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Names used by the Supabase–Vercel integration. */
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  /** MapLibre style URL. Defaults to OpenFreeMap (free, no key). */
  readonly VITE_MAP_STYLE_URL?: string;
  /** "1" to run on the in-browser demo backend (previews/showcases only). */
  readonly VITE_DEMO_MODE?: string;
  /** Demo builds only: open already signed in as a pretend explorer. */
  readonly VITE_DEMO_PERSONA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
