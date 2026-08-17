import { describe, it, expect } from "vitest";
import { toWhatsAppNumber } from "../whatsapp";

describe("toWhatsAppNumber", () => {
  it("convertit un numéro français mobile en format international", () => {
    expect(toWhatsAppNumber("06 12 34 56 78")).toBe("33612345678");
  });

  it("convertit un numéro français fixe", () => {
    expect(toWhatsAppNumber("01 40 50 60 70")).toBe("33140506070");
  });

  it("convertit un numéro avec le préfixe international 00", () => {
    expect(toWhatsAppNumber("0033 6 12 34 56 78")).toBe("33612345678");
  });

  it("conserve un numéro international déjà au bon format", () => {
    expect(toWhatsAppNumber("+33612345678")).toBe("33612345678");
  });

  it("retourne null pour une chaîne vide", () => {
    expect(toWhatsAppNumber("")).toBeNull();
  });

  it("retourne null pour une chaîne sans chiffres", () => {
    expect(toWhatsAppNumber("abc")).toBeNull();
  });

  it("garde un numéro non français tel quel", () => {
    expect(toWhatsAppNumber("442071234567")).toBe("442071234567");
  });
});
