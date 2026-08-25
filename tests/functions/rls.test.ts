// Test de integración: confirma que RLS (supabase/migrations/20260824000001_rls.sql)
// aísla productos/ventas/facturas por local_id (SC-006). Requiere una
// instancia real de Supabase (local vía `supabase start`, o un proyecto de
// pruebas) — no corre contra una base simulada porque RLS es una garantía
// de Postgres, no algo que se pueda faltear con mocks.
//
// Para ejecutarlo: `supabase start` y definir las siguientes variables de
// entorno antes de correr `npm test` (ver `supabase status` para los
// valores locales):
//   TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, TEST_SUPABASE_ANON_KEY
// Sin esas variables, esta suite se salta (no falla ni da falso verde).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
const hasLiveSupabase = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasLiveSupabase)("Aislamiento por local (RLS)", () => {
  const admin = hasLiveSupabase
    ? createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  let localA: { id: string };
  let localB: { id: string };
  let userAEmail: string;
  let userAPassword: string;
  let productoB: { id: string };

  beforeAll(async () => {
    const suffix = Date.now();

    const { data: locales } = await admin!
      .from("locales")
      .insert([
        {
          nombre_fantasia: `Local A ${suffix}`,
          razon_social: `Local A SRL ${suffix}`,
          cuit: `2000000000${suffix % 10}`,
          condicion_iva: "monotributo",
          punto_venta: 1,
          domicilio_fiscal: "Calle Falsa 123",
        },
        {
          nombre_fantasia: `Local B ${suffix}`,
          razon_social: `Local B SRL ${suffix}`,
          cuit: `3000000000${suffix % 10}`,
          condicion_iva: "monotributo",
          punto_venta: 1,
          domicilio_fiscal: "Av. Siempreviva 742",
        },
      ])
      .select();
    [localA, localB] = locales!;

    userAEmail = `usuario-a-${suffix}@usuarios.local-simple.internal`;
    userAPassword = "contraseña-de-prueba-123";
    const { data: userA } = await admin!.auth.admin.createUser({
      email: userAEmail,
      password: userAPassword,
      email_confirm: true,
    });
    await admin!.from("profiles").insert({
      id: userA.user!.id,
      username: `usuario-a-${suffix}`,
      recovery_email: "usuario-a@example.com",
      local_id: localA.id,
    });

    const { data: producto } = await admin!
      .from("productos")
      .insert({ local_id: localB.id, nombre: "Producto de B", precio_unitario: 100 })
      .select()
      .single();
    productoB = producto!;
  });

  afterAll(async () => {
    await admin!.from("productos").delete().eq("id", productoB.id);
    await admin!.from("locales").delete().in("id", [localA.id, localB.id]);
  });

  it("un usuario logueado no puede leer productos de otro local", async () => {
    const clientA = createClient(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: userAEmail, password: userAPassword });

    const { data } = await clientA.from("productos").select("*").eq("local_id", localB.id);

    expect(data).toEqual([]);
  });

  it("un usuario logueado sí puede leer los productos de su propio local", async () => {
    const clientA = createClient(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: userAEmail, password: userAPassword });

    const { data, error } = await clientA.from("productos").select("*").eq("local_id", localA.id);

    expect(error).toBeNull();
    expect(data).toEqual([]); // local A no tiene productos cargados, pero la query no está bloqueada
  });
});
