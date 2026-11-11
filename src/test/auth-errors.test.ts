import { describe, expect, it, vi } from "vitest";
import { authError, signUpOutcome } from "../api/supabase";

describe("sign-up outcome", () => {
  it("treats a user without identities as an existing account (no user created, no email sent)", () => {
    expect(signUpOutcome({ user: { identities: [] }, session: null })).toBe("existing");
  });
  it("asks for email confirmation when there's no session", () => {
    expect(signUpOutcome({ user: { identities: [{}] }, session: null })).toBe("confirmNeeded");
  });
  it("is created when Supabase returns a session (confirmation off)", () => {
    expect(signUpOutcome({ user: { identities: [{}] }, session: {} })).toBe("created");
  });
});

describe("auth errors are never swallowed", () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const code = (e: Parameters<typeof authError>[0]) => authError(e).code;
  it("maps Supabase codes to clear messages", () => {
    expect(code({ message: "Email address not authorized", code: "email_address_not_authorized", status: 400 })).toBe("emailNotAuthorized");
    expect(code({ message: "Signups not allowed for this instance", code: "signup_disabled", status: 422 })).toBe("signupsDisabled");
    expect(code({ message: "User already registered", code: "user_already_exists", status: 422 })).toBe("emailTaken");
    expect(code({ message: "Password is known to be weak", code: "weak_password", status: 422 })).toBe("weakPassword");
    expect(code({ message: "Email rate limit exceeded", code: "over_email_send_rate_limit", status: 429 })).toBe("tooManyRequests");
  });
  it("explains SMTP failures, where Supabase does not create the account", () => {
    expect(code({ message: "Error sending confirmation email", code: "unexpected_failure", status: 500 })).toBe("emailSendFailed");
    expect(code({ message: "Error sending magic link email", status: 500 })).toBe("emailSendFailed");
  });
  it("reports network failures", () => {
    expect(code({ message: "Failed to fetch", name: "AuthRetryableFetchError", status: 0 })).toBe("network");
  });
  it("shows Supabase's own message for anything unexpected", () => {
    const e = authError({ message: "Database error saving new user", code: "unexpected_failure", status: 500 });
    expect(e.code).toBe("authFailed");
    expect(e.params).toEqual({ message: "Database error saving new user" });
  });
});
