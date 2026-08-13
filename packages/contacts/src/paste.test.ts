import { describe, expect, it } from "vitest";
import { parseEmailList } from "./paste";

describe("parseEmailList", () => {
  it("reads a newline-separated column pasted from a spreadsheet", () => {
    const result = parseEmailList("a@x.com\nb@y.com\nc@z.com");
    expect(result.emails).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });

  it("reads a comma-separated line", () => {
    expect(parseEmailList("a@x.com, b@y.com,c@z.com").emails).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
  });

  it("reads semicolons, including the Arabic ones", () => {
    expect(parseEmailList("a@x.com؛ b@y.com، c@z.com").emails).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
  });

  it("pulls the address out of a display-name pair", () => {
    expect(parseEmailList('Sara Ali <sara@x.com>, "HR" <hr@y.com>').emails).toEqual([
      "sara@x.com",
      "hr@y.com",
    ]);
  });

  it("ignores surrounding words rather than calling them errors", () => {
    const result = parseEmailList("Acme Ltd careers@acme.com Riyadh");
    expect(result.emails).toEqual(["careers@acme.com"]);
    expect(result.invalid).toEqual([]);
  });

  it("strips trailing punctuation", () => {
    expect(parseEmailList("write to a@x.com.").emails).toEqual(["a@x.com"]);
  });

  it("lowercases and removes duplicates, counting them", () => {
    const result = parseEmailList("A@X.com\na@x.com\nB@y.com");
    expect(result.emails).toEqual(["a@x.com", "b@y.com"]);
    expect(result.duplicates).toBe(1);
  });

  it("reports fragments that were meant to be addresses", () => {
    const result = parseEmailList("good@x.com\nbroken@\nalso bad@");
    expect(result.emails).toEqual(["good@x.com"]);
    expect(result.invalid).toEqual(["broken@", "bad@"]);
  });

  it("handles an empty paste", () => {
    expect(parseEmailList("   ")).toEqual({
      emails: [],
      invalid: [],
      duplicates: 0,
    });
  });

  it("survives a messy real-world paste", () => {
    const messy = `
      Careers <careers@acme.com>; info@beta.co.uk
      "Gamma Group"  hr@gamma.com.sa , not-an-address
      delta@example.org
    `;
    const result = parseEmailList(messy);
    expect(result.emails).toEqual([
      "careers@acme.com",
      "info@beta.co.uk",
      "hr@gamma.com.sa",
      "delta@example.org",
    ]);
  });
});
