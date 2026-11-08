/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** MapLibre style URL. Defaults to OpenFreeMap (free, no key). */
  readonly VITE_MAP_STYLE_URL?: string;
  /** Demo builds only: open already signed in as a pretend explorer. */
  readonly VITE_DEMO_PERSONA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
