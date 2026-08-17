import { describe, it, expect } from "vitest";
import { isSocialOnlyOrMissing } from "../geoapify";

describe("isSocialOnlyOrMissing", () => {
  it("retourne true si le website est null", () => {
    expect(isSocialOnlyOrMissing(null)).toBe(true);
  });

  it("retourne true si le website est undefined", () => {
    expect(isSocialOnlyOrMissing(undefined)).toBe(true);
  });

  it("retourne true si le website est une chaîne vide", () => {
    expect(isSocialOnlyOrMissing("")).toBe(true);
  });

  it("retourne true si le website est un espace vide", () => {
    expect(isSocialOnlyOrMissing("   ")).toBe(true);
  });

  it("détecte un lien Facebook", () => {
    expect(isSocialOnlyOrMissing("https://facebook.com/moncommerce")).toBe(
      true,
    );
  });

  it("détecte un lien Facebook mobile", () => {
    expect(isSocialOnlyOrMissing("https://m.facebook.com/moncommerce")).toBe(
      true,
    );
  });

  it("détecte un lien Facebook business", () => {
    expect(
      isSocialOnlyOrMissing("https://business.facebook.com/moncommerce"),
    ).toBe(true);
  });

  it("détecte un lien Instagram", () => {
    expect(isSocialOnlyOrMissing("https://instagram.com/moncommerce")).toBe(
      true,
    );
  });

  it("détecte un lien Facebook sans protocol", () => {
    expect(isSocialOnlyOrMissing("facebook.com/moncommerce")).toBe(true);
  });

  it("retourne false pour un vrai site web", () => {
    expect(isSocialOnlyOrMissing("https://mon-site.fr")).toBe(false);
  });

  it("retourne false pour un domaine personnalisé", () => {
    expect(isSocialOnlyOrMissing("https://www.boulangerie-dupont.fr")).toBe(
      false,
    );
  });
});
