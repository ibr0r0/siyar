import { analyze } from "@siyar/ats-core";
import { describe, expect, it } from "vitest";
import { htmlToLines, linesToDocument } from "./docx";
import { detectFileType } from "./index";

describe("htmlToLines", () => {
  it("turns list items into bullet lines the impact checks can see", () => {
    const lines = htmlToLines(
      "<ul><li>Led the migration</li><li>Reduced cost by 30%</li></ul>",
    );
    expect(lines).toEqual(["• Led the migration", "• Reduced cost by 30%"]);
  });

  it("breaks paragraphs and headings onto their own lines", () => {
    const lines = htmlToLines(
      "<h1>Sara Al-Otaibi</h1><p>Senior Data Analyst</p><p>Jeddah</p>",
    );
    expect(lines).toEqual(["Sara Al-Otaibi", "Senior Data Analyst", "Jeddah"]);
  });

  it("separates table cells instead of running them together", () => {
    const lines = htmlToLines(
      "<table><tr><td>2019</td><td>Analyst</td></tr></table>",
    );
    expect(lines).toEqual(["2019 Analyst"]);
  });

  it("decodes named and numeric entities", () => {
    expect(htmlToLines("<p>R&amp;D &#1575;&#1604;&#1585;&#1610;&#1575;&#1590;</p>")).toEqual([
      "R&D الرياض",
    ]);
  });

  it("repairs Arabic stored as shaped glyphs", () => {
    expect(htmlToLines("<p>ﺽﺎﻳﺮﻟﺍ</p>")).toEqual(["الرياض"]);
  });

  it("drops empty blocks", () => {
    expect(htmlToLines("<p></p><p>  </p><p>real</p>")).toEqual(["real"]);
  });
});

describe("linesToDocument", () => {
  const lines = ["Sara Al-Otaibi", "Senior Data Analyst", "Jeddah"];
  const doc = linesToDocument(lines, { fileName: "sara.docx", byteLength: 4096 });

  it("marks the document as docx so geometry-dependent checks skip", () => {
    expect(doc.source.fileType).toBe("docx");

    const report = analyze(doc);
    for (const id of [
      "readability.single-column",
      "readability.margin-content",
      "readability.embedded-fonts",
    ]) {
      expect(report.checks.find((check) => check.id === id)?.status).toBe(
        "skipped",
      );
    }
  });

  it("still reports a text layer", () => {
    expect(doc.meta.hasTextLayer).toBe(true);
  });

  it("indexes lines contiguously", () => {
    expect(doc.lines.map((line) => line.index)).toEqual([0, 1, 2]);
  });

  it("paginates long documents", () => {
    const many = Array.from({ length: 100 }, (_, i) => `line ${i}`);
    const paged = linesToDocument(many, { fileName: "x.docx", byteLength: 1 });
    expect(paged.pages.length).toBeGreaterThan(1);
  });
});

describe("detectFileType", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]);

  it("identifies a PDF by its signature", () => {
    expect(detectFileType(pdf, "cv.pdf")).toBe("pdf");
  });

  it("identifies a DOCX by its zip signature", () => {
    expect(detectFileType(docx, "cv.docx")).toBe("docx");
  });

  it("trusts the signature over a wrong extension", () => {
    expect(detectFileType(docx, "cv.pdf")).toBe("docx");
  });

  it("falls back to the extension when the signature is unknown", () => {
    expect(detectFileType(new Uint8Array([0, 1, 2, 3]), "cv.pdf")).toBe("pdf");
  });

  it("rejects anything else", () => {
    expect(detectFileType(new Uint8Array([0, 1, 2, 3]), "cv.txt")).toBeNull();
  });
});
