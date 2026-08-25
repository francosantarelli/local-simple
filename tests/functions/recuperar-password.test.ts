import { describe, it, expect, vi } from "vitest";
import { handleRecuperarPassword } from "../../supabase/functions/recuperar-password/logic";

describe("handleRecuperarPassword", () => {
  it("responde 400 si falta el username", async () => {
    const result = await handleRecuperarPassword("", {
      findProfileByUsername: vi.fn(),
      generateRecoveryLink: vi.fn(),
      sendRecoveryEmail: vi.fn(),
    });

    expect(result.status).toBe(400);
  });

  it("si el username existe, genera el link y envía el email al recovery_email", async () => {
    const findProfileByUsername = vi.fn().mockResolvedValue({
      username: "maria",
      recoveryEmail: "maria.real@gmail.com",
      authEmail: "maria@usuarios.local-simple.internal",
    });
    const generateRecoveryLink = vi
      .fn()
      .mockResolvedValue("https://proyecto.supabase.co/auth/v1/verify?token=abc");
    const sendRecoveryEmail = vi.fn().mockResolvedValue(undefined);

    const result = await handleRecuperarPassword("maria", {
      findProfileByUsername,
      generateRecoveryLink,
      sendRecoveryEmail,
    });

    expect(findProfileByUsername).toHaveBeenCalledWith("maria");
    expect(generateRecoveryLink).toHaveBeenCalledWith(
      "maria@usuarios.local-simple.internal"
    );
    expect(sendRecoveryEmail).toHaveBeenCalledWith(
      "maria.real@gmail.com",
      "https://proyecto.supabase.co/auth/v1/verify?token=abc"
    );
    expect(result.status).toBe(200);
  });

  it("si el username no existe, responde 200 genérico sin enviar nada (no revela qué usuarios existen)", async () => {
    const findProfileByUsername = vi.fn().mockResolvedValue(null);
    const generateRecoveryLink = vi.fn();
    const sendRecoveryEmail = vi.fn();

    const result = await handleRecuperarPassword("no-existe", {
      findProfileByUsername,
      generateRecoveryLink,
      sendRecoveryEmail,
    });

    expect(generateRecoveryLink).not.toHaveBeenCalled();
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
    expect(result.body.message).toMatch(/si el usuario existe/i);
  });

  it("normaliza el username a minúsculas antes de buscarlo", async () => {
    const findProfileByUsername = vi.fn().mockResolvedValue(null);

    await handleRecuperarPassword("MarIa", {
      findProfileByUsername,
      generateRecoveryLink: vi.fn(),
      sendRecoveryEmail: vi.fn(),
    });

    expect(findProfileByUsername).toHaveBeenCalledWith("maria");
  });
});
