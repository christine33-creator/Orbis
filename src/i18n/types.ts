import type { en } from "./locales/en";

/** Every locale must have exactly the same keys as English (checked at build time). */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Translation = Shape<typeof en>;
