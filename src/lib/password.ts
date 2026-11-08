/**
 * Password rules shown to people as they type. Supabase Auth enforces the same minimum
 * (8+ characters, at least one letter and one digit) on the server, so these are for feedback only.
 */
export const PASSWORD_MIN = 8;

export type PasswordRule = "length" | "letter" | "digit" | "notEmail";

export function passwordRules(password: string, email = ""): Record<PasswordRule, boolean> {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return {
    length: password.length >= PASSWORD_MIN,
    letter: /[A-Za-z]/.test(password),
    digit: /\d/.test(password),
    notEmail: !local || local.length < 3 || !password.toLowerCase().includes(local),
  };
}

export const passwordValid = (password: string, email = "") => Object.values(passwordRules(password, email)).every(Boolean);

/** 0–4, from length and character variety. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (/^(.)\1+$/.test(password) || /^(password|12345678|qwerty)/i.test(password)) score = 0;
  return Math.min(score, 4);
}
