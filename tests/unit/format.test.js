import { describe, it, expect } from "vitest";
import { formatFecha } from "../../docs/js/format.js";

describe("formatFecha", () => {
  it("convierte ISO (AAAA-MM-DD) a DD-MM-AAAA", () => {
    expect(formatFecha("2026-08-30")).toBe("30-08-2026");
  });

  it("devuelve string vacío si no hay fecha", () => {
    expect(formatFecha("")).toBe("");
    expect(formatFecha(null)).toBe("");
    expect(formatFecha(undefined)).toBe("");
  });
});
