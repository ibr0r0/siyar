import { describe, expect, it } from "vitest";
import { buildLines, toTextItems, type RawTextItem } from "./layout";

const PAGE = { width: 595, height: 842 };

/**
 * Build a pdf.js-shaped item. `yFromBottom` is a PDF baseline coordinate, which
 * is what makes the coordinate-flip assertions below meaningful.
 */
function item(
  str: string,
  x: number,
  yFromBottom: number,
  options: {
    width?: number;
    size?: number;
    fontName?: string;
    dir?: "ltr" | "rtl";
  } = {},
): RawTextItem {
  const size = options.size ?? 11;
  return {
    str,
    transform: [size, 0, 0, size, x, yFromBottom],
    width: options.width ?? str.length * 5,
    height: size,
    fontName: options.fontName ?? "g_d0_f1",
    // pdf.js tags every run; default by script the way it would.
    dir: options.dir ?? (/[؀-ۿ]/.test(str) ? "rtl" : "ltr"),
  };
}

describe("coordinate conversion", () => {
  it("flips PDF bottom-left origin to top-left", () => {
    const [converted] = toTextItems([item("Riyadh", 60, 782)], PAGE);
    // 842 - 782 - 11 = 49 from the top.
    expect(converted?.y).toBe(49);
    expect(converted?.x).toBe(60);
  });

  it("takes the font size from the vertical scale, not the reported height", () => {
    const [converted] = toTextItems(
      [item("Heading", 60, 700, { size: 22 })],
      PAGE,
    );
    expect(converted?.fontSize).toBe(22);
  });
});

describe("line grouping", () => {
  it("merges fragments that share a baseline", () => {
    const { lines } = buildLines(
      [
        item("Senior ", 60, 700, { width: 40 }),
        item("Data ", 101, 700, { width: 26 }),
        item("Analyst", 128, 700, { width: 38 }),
      ],
      PAGE,
      0,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe("Senior Data Analyst");
  });

  it("keeps separate baselines as separate lines, in top-to-bottom order", () => {
    const { lines } = buildLines(
      [item("second", 60, 680), item("first", 60, 700)],
      PAGE,
      0,
    );

    expect(lines.map((line) => line.text)).toEqual(["first", "second"]);
  });

  it("inserts a space when fragments are positioned apart with no space glyph", () => {
    const { lines } = buildLines(
      [
        item("Data", 60, 700, { width: 24 }),
        // A 10pt gap on 11pt type — wider than the quarter-em threshold.
        item("Analyst", 94, 700, { width: 38 }),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.text).toBe("Data Analyst");
  });

  it("does not double up spaces that are already there", () => {
    const { lines } = buildLines(
      [
        item("Data ", 60, 700, { width: 28 }),
        item("Analyst", 90, 700, { width: 38 }),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.text).toBe("Data Analyst");
  });
});

describe("reading order", () => {
  it("reads a right-to-left row from the right", () => {
    const { lines } = buildLines(
      [
        item("برمجيات", 60, 700, { width: 45 }),
        item("مهندس", 115, 700, { width: 38 }),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.text).toBe("مهندس برمجيات");
  });

  it("reads a left-to-right row from the left", () => {
    const { lines } = buildLines(
      [item("Engineer", 115, 680, { width: 45 }), item("Software", 60, 680, { width: 45 })],
      PAGE,
      0,
    );
    expect(lines[0]?.text).toBe("Software Engineer");
  });

  it("does not reverse Latin terms in a line merely punctuated with Arabic", () => {
    // A skills line reading "Java، Spring Boot، Kafka" is laid out left to
    // right; pdf.js tags even the Arabic commas `ltr` because they are neutrals
    // among Latin. Treating the row as right-to-left because it *contains* an
    // Arabic character emits "Kafka، Boot Spring، Java".
    const { lines } = buildLines(
      [
        item("Java", 201, 700, { width: 23, dir: "ltr" }),
        item("،", 225, 700, { width: 3, dir: "ltr" }),
        item("Spring Boot", 231, 700, { width: 58, dir: "ltr" }),
        item("،", 289, 700, { width: 3, dir: "ltr" }),
        item("Kafka", 296, 700, { width: 28, dir: "ltr" }),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.text).toBe("Java، Spring Boot، Kafka");
  });

  it("orders a mixed Arabic and numeric date range", () => {
    // Laid out on the page as "2020 ديسمبر - 2018 مارس", left to right.
    const { lines } = buildLines(
      [
        item("2020", 420, 700, { width: 25, dir: "ltr" }),
        item("ديسمبر", 448, 700, { width: 28, dir: "rtl" }),
        item(" - ", 478, 700, { width: 8, dir: "ltr" }),
        item("2018", 489, 700, { width: 25, dir: "ltr" }),
        item("مارس", 517, 700, { width: 22, dir: "rtl" }),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.text).toBe("مارس 2018 - ديسمبر 2020");
  });

  it("keeps a multi-fragment Latin run intact inside an Arabic line", () => {
    // "الجوال +966 551234567" — reversing the whole row would emit the phone
    // number as "551234567 +966".
    const { lines } = buildLines(
      [
        item("+966", 300, 700, { width: 25, dir: "ltr" }),
        item("551234567", 328, 700, { width: 55, dir: "ltr" }),
        item("الجوال", 390, 700, { width: 30, dir: "rtl" }),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.text).toBe("الجوال +966 551234567");
  });

  it("groups a row whose fragments differ slightly in baseline", () => {
    // Superscripts and inline font changes shift the baseline by a fraction of
    // a point; the row must still come back in its original order.
    const { lines } = buildLines(
      [
        item("first", 60, 700.0, { width: 26 }),
        item("second", 92, 700.4, { width: 34 }),
        item("third", 132, 699.7, { width: 26 }),
      ],
      PAGE,
      0,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe("first second third");
  });

  it("repairs a line stored as shaped glyphs and flags that it did", () => {
    // "الرياض" written as isolated presentation forms in visual order, the way
    // a PDF produced by a non-Unicode-aware tool stores it.
    const glyphs = "ﺽﺎﻳﺮﻟﺍ";
    const { lines, repairedVisualOrder } = buildLines(
      [item(glyphs, 60, 700, { width: 40 })],
      PAGE,
      0,
    );

    expect(repairedVisualOrder).toBe(true);
    expect(lines[0]?.text).toBe("الرياض");
  });

  it("does not flag ordinary Arabic as needing repair", () => {
    const { repairedVisualOrder } = buildLines(
      [item("الرياض", 60, 700)],
      PAGE,
      0,
    );
    expect(repairedVisualOrder).toBe(false);
  });
});

describe("emphasis", () => {
  it("marks larger type as emphasised", () => {
    const { lines } = buildLines(
      [
        item("Sara Al-Otaibi", 60, 780, { size: 20 }),
        item("body text one", 60, 700),
        item("body text two", 60, 686),
        item("body text three", 60, 672),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.emphasised).toBe(true);
    expect(lines[1]?.emphasised).toBe(false);
  });

  it("marks bold fonts as emphasised", () => {
    const { lines } = buildLines(
      [
        item("Experience", 60, 700, { fontName: "IBMPlexSansArabic-Bold" }),
        item("body", 60, 686),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.emphasised).toBe(true);
  });
});

describe("bounding boxes", () => {
  it("spans the full extent of the row", () => {
    const { lines } = buildLines(
      [
        item("left", 60, 700, { width: 30 }),
        item("right", 200, 700, { width: 40 }),
      ],
      PAGE,
      0,
    );
    expect(lines[0]?.x).toBe(60);
    expect(lines[0]?.width).toBe(180); // 240 - 60
  });

  it("drops rows that hold nothing but whitespace", () => {
    const { lines } = buildLines([item("   ", 60, 700)], PAGE, 0);
    expect(lines).toEqual([]);
  });
});
