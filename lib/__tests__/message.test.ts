import { describe, it, expect } from "vitest";
import { personalizeMessage, escapeHtml } from "../message";

describe("personalizeMessage", () => {
  it("remplace un placeholder simple", () => {
    expect(personalizeMessage("Bonjour {{name}}", { name: "Chez Marie" })).toBe(
      "Bonjour Chez Marie"
    );
  });

  it("remplace plusieurs placeholders", () => {
    const result = personalizeMessage("Nom: {{name}}, Email: {{email}}", {
      name: "Boulangerie",
      email: "contact@test.fr",
    });
    expect(result).toBe("Nom: Boulangerie, Email: contact@test.fr");
  });

  it("remplace un placeholder avec des espaces", () => {
    expect(personalizeMessage("{{ name }}", { name: "Test" })).toBe("Test");
  });

  it("conserve les placeholders inconnus", () => {
    expect(personalizeMessage("Bonjour {{unknown}}", {})).toBe("Bonjour {{unknown}}");
  });

  it("remplace par une chaîne vide si la valeur est null", () => {
    expect(personalizeMessage("Nom: {{name}}", { name: null })).toBe("Nom: ");
  });

  it("remplace par une chaîne vide si la valeur est undefined", () => {
    expect(personalizeMessage("Nom: {{name}}", { name: undefined })).toBe("Nom: ");
  });

  it("retourne le message inchangé s'il n'y a aucun placeholder", () => {
    const msg = "Pas de placeholder ici";
    expect(personalizeMessage(msg, { name: "Test" })).toBe(msg);
  });
});

describe("escapeHtml", () => {
  it("échappe les caractères dangereux", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  it("échappe les esperluettes", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("échappe les guillemets simples", () => {
    expect(escapeHtml("l'apostrophe")).toBe("l&#039;apostrophe");
  });

  it("retourne une chaîne propre inchangée", () => {
    expect(escapeHtml("Bonjour le monde")).toBe("Bonjour le monde");
  });
});
