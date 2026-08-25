import { describe, it, expect, vi } from "vitest";
import { usernameToSyntheticEmail, createAuthService } from "../../docs/js/auth.js";

describe("usernameToSyntheticEmail", () => {
  it("deriva un email interno determinístico a partir del username", () => {
    expect(usernameToSyntheticEmail("maria")).toBe(
      "maria@usuarios.local-simple.internal"
    );
  });

  it("normaliza el username a minúsculas y sin espacios", () => {
    expect(usernameToSyntheticEmail(" Maria ")).toBe(
      "maria@usuarios.local-simple.internal"
    );
  });

  it("rechaza un username vacío", () => {
    expect(() => usernameToSyntheticEmail("")).toThrow();
  });
});

describe("createAuthService", () => {
  it("login resuelve el email interno sintético y delega en signInWithPassword", async () => {
    const signInWithPassword = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const client = { auth: { signInWithPassword, signOut: vi.fn() } };
    const auth = createAuthService(client);

    const result = await auth.login("maria", "secreta123");

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "maria@usuarios.local-simple.internal",
      password: "secreta123",
    });
    expect(result.error).toBeNull();
    expect(result.user).toEqual({ id: "u1" });
  });

  it("login propaga un error de credenciales inválidas sin lanzar excepción", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });
    const client = { auth: { signInWithPassword, signOut: vi.fn() } };
    const auth = createAuthService(client);

    const result = await auth.login("maria", "mal-password");

    expect(result.error).toBeTruthy();
    expect(result.user).toBeNull();
  });

  it("logout delega en signOut", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { signInWithPassword: vi.fn(), signOut } };
    const auth = createAuthService(client);

    await auth.logout();

    expect(signOut).toHaveBeenCalled();
  });

  it("requireSession devuelve la sesión cuando existe", async () => {
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    const client = { auth: { signInWithPassword: vi.fn(), signOut: vi.fn(), getSession } };
    const auth = createAuthService(client);

    const session = await auth.requireSession();

    expect(session).toEqual({ user: { id: "u1" } });
  });

  it("requireSession devuelve null cuando no hay sesión", async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } });
    const client = { auth: { signInWithPassword: vi.fn(), signOut: vi.fn(), getSession } };
    const auth = createAuthService(client);

    const session = await auth.requireSession();

    expect(session).toBeNull();
  });
});
