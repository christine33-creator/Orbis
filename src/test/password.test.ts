import { describe, expect, it } from "vitest";
import { passwordRules, passwordStrength, passwordValid } from "../lib/password";

describe("password rules", () => {
  it("requires 8+ characters with a letter and a digit", () => {
    expect(passwordValid("short1")).toBe(false);
    expect(passwordValid("longenough")).toBe(false);
    expect(passwordValid("12345678")).toBe(false);
    expect(passwordValid("travel2026")).toBe(true);
  });
  it("rejects passwords containing the email name", () => {
    expect(passwordRules("janetravels1", "janetravels@example.com").notEmail).toBe(false);
    expect(passwordValid("Kyoto-maple-7", "jane@example.com")).toBe(true);
  });
  it("scores strength", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("password123")).toBe(0);
    expect(passwordStrength("travel2026")).toBe(1);
    expect(passwordStrength("Travel-Lisbon-2026")).toBe(4);
  });
});
