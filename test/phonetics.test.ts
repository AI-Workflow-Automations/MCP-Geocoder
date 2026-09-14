import { describe, expect, it } from "bun:test";

import { encodePhrase, encodeWord } from "../src/domain/phonetics.js";

describe("Kölner Phonetik", () => {
  it("bildet gleichklingende Namen auf denselben Code ab", () => {
    expect(encodeWord("Meier")).toBe(encodeWord("Mayer"));
    expect(encodeWord("Müller")).toBe(encodeWord("Mueller"));
    expect(encodeWord("Heinrich")).toBe(encodeWord("Henrich"));
  });

  it("trennt unterschiedlich klingende Namen", () => {
    expect(encodeWord("Bachmann")).not.toBe(encodeWord("Lachmann"));
    expect(encodeWord("Tor")).not.toBe(encodeWord("Berg"));
  });

  it("liefert den dokumentierten Referenzcode", () => {
    expect(encodeWord("Wikipedia")).toBe("3412");
    expect(encodeWord("Müller-Lüdenscheidt")).toBe("65752682");
  });

  it("kodiert Wortfolgen wortweise", () => {
    expect(encodePhrase("ernst reuter")).toBe(`${encodeWord("ernst")} ${encodeWord("reuter")}`);
  });
});
