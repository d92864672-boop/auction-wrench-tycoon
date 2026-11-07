import { describe, expect, it } from "vitest";
import { interpretAuthorizeProbe } from "../server/auth-provider-api";

describe("interpretAuthorizeProbe", () => {
  it("считает провайдера включённым при редиректе на Google", () => {
    const status = interpretAuthorizeProbe(302, "");
    expect(status.available).toBe(true);
    expect(status.reason).toBeNull();
    expect(status.provider).toBe("google");
  });

  it("объясняет, что провайдер не настроен, когда Supabase отвечает missing OAuth secret", () => {
    const status = interpretAuthorizeProbe(
      400,
      JSON.stringify({ code: 400, error_code: "validation_failed", msg: "Unsupported provider: missing OAuth secret" }),
    );
    expect(status.available).toBe(false);
    expect(status.reason).toContain("Supabase");
    expect(status.reason).toContain("Client ID");
  });

  it("не выдаёт ошибку сервера за настроенный провайдер", () => {
    const status = interpretAuthorizeProbe(503, "upstream boom");
    expect(status.available).toBe(false);
    expect(status.reason).toContain("503");
  });

  it("сообщает про недоступность провайдера при 400 без тела", () => {
    const status = interpretAuthorizeProbe(400, "");
    expect(status.available).toBe(false);
    expect(status.reason).not.toBeNull();
  });
});
