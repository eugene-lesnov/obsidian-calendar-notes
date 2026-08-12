import { afterEach, describe, expect, it } from "vitest";

import strings, {
  formatLocalizedString,
  getLocales,
  getRepeatLabel,
  setLocale,
} from "../src/core/localization";

describe("localization", () => {
  afterEach(() => setLocale("en"));

  it("normalizes locale priority and falls back from region to language", () => {
    setLocale(["ru-RU", "en-US"]);
    expect(getLocales()).toEqual(["ru-RU", "ru", "en-US", "en"]);
    expect(strings.todayButtonLabel).toBe("Сегодня");
  });

  it("falls back to default strings for unsupported locales", () => {
    setLocale("xx-YY");
    expect(strings.todayButtonLabel).toBe("Today");
  });

  it("formats known placeholders and preserves missing ones", () => {
    expect(formatLocalizedString("{{count}}: {{name}}: {{missing}}", {
      count: 2,
      name: "Tasks",
    })).toBe("2: Tasks: {{missing}}");
  });

  it("returns labels for every repeat frequency", () => {
    setLocale("en");
    expect([
      getRepeatLabel("daily"),
      getRepeatLabel("weekly"),
      getRepeatLabel("monthly"),
      getRepeatLabel("yearly"),
    ]).toEqual(["Every day", "Every week", "Every month", "Every year"]);
  });
});
