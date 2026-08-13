import { describe, expect, it } from "vitest";
import { assembleBody, isProfileComplete, signatureLines } from "./template";

describe("assembleBody", () => {
  it("separates blocks with a single blank line", () => {
    expect(assembleBody(["Hello,", "I am applying.", "Thanks"])).toBe(
      "Hello,\n\nI am applying.\n\nThanks",
    );
  });

  it("drops empty blocks so an unfilled field leaves no gap", () => {
    expect(assembleBody(["Hello,", undefined, "", "   ", "Thanks"])).toBe(
      "Hello,\n\nThanks",
    );
  });

  it("keeps the internal lines of a multi-line block together", () => {
    expect(assembleBody(["Regards,", "Ahmed\n+966551234567"])).toBe(
      "Regards,\n\nAhmed\n+966551234567",
    );
  });

  it("leaves no trailing blank line", () => {
    expect(assembleBody(["Hello", "", undefined]).endsWith("\n")).toBe(false);
  });

  it("returns an empty string when there is nothing to say", () => {
    expect(assembleBody([undefined, "", null])).toBe("");
  });
});

describe("signatureLines", () => {
  it("includes only the details that were filled in", () => {
    expect(
      signatureLines({ name: "Ahmed", title: "Engineer", phone: "+966551234567" }),
    ).toEqual(["Ahmed", "+966551234567"]);
  });

  it("orders name, phone, LinkedIn, CV link", () => {
    expect(
      signatureLines({
        name: "Sara",
        title: "Analyst",
        linkedin: "linkedin.com/in/sara",
        phone: "+966559876543",
        cvUrl: "https://example.com/cv.pdf",
      }),
    ).toEqual([
      "Sara",
      "+966559876543",
      "linkedin.com/in/sara",
      "https://example.com/cv.pdf",
    ]);
  });

  it("ignores whitespace-only values", () => {
    expect(signatureLines({ name: "Ahmed", title: "Engineer", phone: "  " })).toEqual([
      "Ahmed",
    ]);
  });
});

describe("isProfileComplete", () => {
  it("requires a name and a title", () => {
    expect(isProfileComplete({ name: "Ahmed", title: "Engineer" })).toBe(true);
    expect(isProfileComplete({ name: "", title: "Engineer" })).toBe(false);
    expect(isProfileComplete({ name: "Ahmed", title: "  " })).toBe(false);
  });
});
