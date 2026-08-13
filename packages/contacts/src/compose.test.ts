import { describe, expect, it } from "vitest";
import {
  buildGmailUrl,
  buildMailtoUrl,
  chunkRecipients,
  dedupeEmails,
  MAILTO_URL_BUDGET,
  renderTemplate,
  usesMergeFields,
} from "./compose";
import { checkReadiness, todayKey } from "./guardrails";
import { hashEmail, removeSuppressed } from "./suppression";
import { guessMapping, isValidEmail, parseCsv, toSheet } from "./csv";

const addresses = (count: number, prefix = "careers") =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}@company${i}.com`);

describe("buildMailtoUrl", () => {
  it("puts recipients in bcc so nobody sees the others", () => {
    const url = buildMailtoUrl({
      bcc: ["a@x.com", "b@y.com"],
      subject: "Application",
      body: "Hello",
    });
    expect(url).toContain("bcc=a%40x.com,b%40y.com");
    expect(url.startsWith("mailto:?")).toBe(true);
  });

  it("keeps the commas between addresses literal", () => {
    // A client splits on the comma; encoding it as %2C produces one very long
    // invalid address instead of two valid ones.
    const url = buildMailtoUrl({ bcc: ["a@x.com", "b@y.com"], subject: "s", body: "b" });
    expect(url).not.toContain("%2C");
  });

  it("percent-encodes Arabic subjects and bodies", () => {
    const url = buildMailtoUrl({
      bcc: ["a@x.com"],
      subject: "طلب توظيف",
      body: "مرحبًا",
    });
    expect(url).toContain("subject=%D8%B7%D9%84%D8%A8");
    expect(url).not.toContain("طلب");
  });

  it("encodes ampersands in the body instead of starting a new parameter", () => {
    const url = buildMailtoUrl({ bcc: ["a@x.com"], subject: "s", body: "R&D team" });
    expect(url).toContain("body=R%26D%20team");
  });
});

describe("buildGmailUrl", () => {
  it("targets the Gmail compose view", () => {
    const url = buildGmailUrl({ bcc: ["a@x.com"], subject: "s", body: "b" });
    expect(url.startsWith("https://mail.google.com/mail/?view=cm&fs=1")).toBe(true);
    expect(url).toContain("su=s");
  });
});

describe("chunkRecipients", () => {
  it("caps each batch at the requested size", () => {
    const batches = chunkRecipients(addresses(60), {
      subject: "s",
      body: "b",
      maxPerBatch: 25,
    });
    expect(batches).toHaveLength(3);
    expect(batches[0]?.recipients).toHaveLength(25);
    expect(batches[2]?.recipients).toHaveLength(10);
  });

  it("keeps every batch inside the mailto budget", () => {
    const batches = chunkRecipients(addresses(200), {
      subject: "Application for a software engineering role",
      body: "Hello,\n\nPlease find my CV attached.\n\nThanks",
      maxPerBatch: 100,
    });
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(MAILTO_URL_BUDGET);
      expect(batch.overBudget).toBe(false);
    }
  });

  it("loses nobody while splitting", () => {
    const emails = addresses(137);
    const batches = chunkRecipients(emails, { subject: "s", body: "b" });
    expect(batches.flatMap((batch) => batch.recipients)).toEqual(emails);
  });

  it("splits sooner for a long Arabic body, which encodes far larger", () => {
    const body = "مرحبًا، أرفق لكم سيرتي الذاتية للاطلاع عليها. ".repeat(6);
    const arabic = chunkRecipients(addresses(60), { subject: "طلب", body });
    const latin = chunkRecipients(addresses(60), { subject: "Hi", body: "Hi" });
    expect(arabic.length).toBeGreaterThan(latin.length);
  });

  it("marks a long Arabic body as mailto-only-too-long, not undeliverable", () => {
    // The default Arabic message encodes to ~1966 characters: past mailto's
    // 1800 ceiling, far inside Gmail's. Treating that as unsendable would
    // refuse the primary path for the primary language.
    const body = "السلام عليكم، أتقدّم بطلب للانضمام إلى فريقكم. ".repeat(9);
    const [batch] = chunkRecipients(["a@x.com"], { subject: "طلب", body });
    expect(batch?.mailtoOverBudget).toBe(true);
    expect(batch?.overBudget).toBe(false);
    expect(batch?.gmailLength).toBeLessThan(8000);
  });

  it("flags a body too long for every transport", () => {
    const batches = chunkRecipients(["a@x.com"], {
      subject: "s",
      body: "x".repeat(9000),
    });
    expect(batches).toHaveLength(1);
    expect(batches[0]?.overBudget).toBe(true);
  });

  it("allows far larger batches when targeting Gmail", () => {
    const mailto = chunkRecipients(addresses(200), { subject: "s", body: "b", maxPerBatch: 500 });
    const gmail = chunkRecipients(addresses(200), {
      subject: "s",
      body: "b",
      maxPerBatch: 500,
      target: "gmail",
    });
    expect(gmail.length).toBeLessThan(mailto.length);
  });

  it("returns nothing for an empty list", () => {
    expect(chunkRecipients([], { subject: "s", body: "b" })).toEqual([]);
  });
});

describe("renderTemplate", () => {
  it("substitutes merge fields", () => {
    const result = renderTemplate("مرحبًا فريق {{company}}", { company: "أرامكو" });
    expect(result.text).toBe("مرحبًا فريق أرامكو");
    expect(result.unresolved).toEqual([]);
  });

  it("reports unresolved placeholders rather than blanking them", () => {
    const result = renderTemplate("Dear {{company}} — re {{role}}", {
      company: "Acme",
    });
    expect(result.unresolved).toEqual(["role"]);
    expect(result.text).toContain("{{role}}");
  });

  it("treats an empty value as unresolved", () => {
    expect(renderTemplate("Hi {{company}}", { company: "  " }).unresolved).toEqual([
      "company",
    ]);
  });

  it("detects whether a template personalises at all", () => {
    expect(usesMergeFields("Hi {{company}}")).toBe(true);
    expect(usesMergeFields("Hi there")).toBe(false);
  });
});

describe("dedupeEmails", () => {
  it("removes case and whitespace duplicates, keeping order", () => {
    expect(dedupeEmails([" A@X.com ", "b@y.com", "a@x.com"])).toEqual([
      "a@x.com",
      "b@y.com",
    ]);
  });
});

describe("suppression", () => {
  it("hashes consistently regardless of case or padding", async () => {
    expect(await hashEmail(" Careers@Example.com ")).toBe(
      await hashEmail("careers@example.com"),
    );
  });

  it("subtracts suppressed addresses from a list", async () => {
    const blocked = await hashEmail("no@thanks.com");
    const result = await removeSuppressed(
      ["keep@a.com", "NO@thanks.com", "keep2@b.com"],
      [blocked],
    );
    expect(result.allowed).toEqual(["keep@a.com", "keep2@b.com"]);
    expect(result.removed).toEqual(["no@thanks.com"]);
  });
});

describe("csv", () => {
  it("parses quoted fields containing commas", () => {
    const rows = parseCsv('email,org\n"a@x.com","Acme, Inc."');
    expect(rows[1]).toEqual(["a@x.com", "Acme, Inc."]);
  });

  it("handles doubled quotes and embedded newlines", () => {
    const rows = parseCsv('a,b\n"say ""hi""","line1\nline2"');
    expect(rows[1]).toEqual(['say "hi"', "line1\nline2"]);
  });

  it("strips the BOM Excel writes", () => {
    const { headers } = toSheet(parseCsv("﻿email,org\na@x.com,Acme"));
    expect(headers[0]).toBe("email");
  });

  it("accepts semicolon and tab separated exports", () => {
    expect(parseCsv("a;b\n1;2")[1]).toEqual(["1", "2"]);
    expect(parseCsv("a\tb\n1\t2")[1]).toEqual(["1", "2"]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toHaveLength(2);
  });

  it("guesses columns from English and Arabic headers", () => {
    expect(guessMapping(["Company", "Email Address", "City"])).toMatchObject({
      org: 0,
      email: 1,
      city: 2,
    });
    expect(guessMapping(["الشركة", "البريد الإلكتروني"])).toMatchObject({
      org: 0,
      email: 1,
    });
  });

  it("finds the address column in a file with no header row", () => {
    expect(guessMapping(["a@x.com", "Acme"]).email).toBe(0);
  });

  it("validates addresses", () => {
    expect(isValidEmail("careers@example.com")).toBe(true);
    expect(isValidEmail("not an email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("guardrails", () => {
  const base = {
    mode: "batch" as const,
    subject: "Application",
    body: "Hello",
    template: "Hello {{company}}",
    recipientCount: 10,
    sentToday: 0,
    unresolved: [],
    overBudgetBatches: 0,
  };

  it("passes a well-formed batch", () => {
    const result = checkReadiness(base);
    expect(result.ok).toBe(true);
    expect(result.remainingToday).toBe(50);
  });

  it("blocks an empty subject or body", () => {
    expect(checkReadiness({ ...base, subject: " " }).blockers).toContain("noSubject");
    expect(checkReadiness({ ...base, body: "" }).blockers).toContain("noBody");
  });

  it("blocks once the daily cap is spent", () => {
    const result = checkReadiness({ ...base, sentToday: 50 });
    expect(result.blockers).toContain("dailyCapReached");
    expect(result.remainingToday).toBe(0);
  });

  it("blocks only when no transport can carry the message", () => {
    expect(checkReadiness({ ...base, overBudgetBatches: 1 }).blockers).toContain(
      "urlTooLong",
    );
  });

  it("warns, but does not block, when only the mail app cannot carry it", () => {
    const result = checkReadiness({ ...base, mailtoOverBudgetBatches: 3 });
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain("mailAppUnavailable");
    expect(result.blockers).not.toContain("urlTooLong");
  });

  it("blocks unfilled placeholders in targeted mode only", () => {
    const targeted = checkReadiness({
      ...base,
      mode: "targeted",
      unresolved: ["company"],
    });
    expect(targeted.blockers).toContain("unresolvedFields");

    const batch = checkReadiness({ ...base, unresolved: ["company"] });
    expect(batch.blockers).not.toContain("unresolvedFields");
  });

  it("warns, but does not block, when the company name falls back to generic", () => {
    // Pasted addresses carry no organisation name. Blocking here would make
    // the commonest way of adding recipients a dead end.
    const result = checkReadiness({ ...base, genericCompanyCount: 4 });
    expect(result.warnings).toContain("genericCompany");
    expect(result.ok).toBe(true);
  });

  it("stays silent when every recipient has a name", () => {
    expect(checkReadiness({ ...base, genericCompanyCount: 0 }).warnings).not.toContain(
      "genericCompany",
    );
  });

  it("warns, but does not block, an unpersonalised blast", () => {
    const result = checkReadiness({ ...base, template: "Hello everyone" });
    expect(result.warnings).toContain("notPersonalised");
    expect(result.ok).toBe(true);
  });

  it("keys the daily counter to the local day", () => {
    expect(todayKey(new Date(2026, 7, 13))).toBe("2026-08-13");
  });
});
