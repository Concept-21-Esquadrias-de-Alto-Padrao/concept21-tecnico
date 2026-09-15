import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  buildCalendarMonth,
  formatCalendarMonth,
  getInitialCalendarDate,
  getInitialCalendarMonth,
} from "@/lib/technical-calendar";

describe("technical calendar", () => {
  it("builds a Monday-first grid with six complete weeks", () => {
    const days = buildCalendarMonth("2026-09", "2026-09-15");

    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ isoDate: "2026-08-31", inCurrentMonth: false });
    expect(days[15]).toMatchObject({ isoDate: "2026-09-15", isToday: true });
    expect(days.at(-1)).toMatchObject({ isoDate: "2026-10-11", inCurrentMonth: false });
  });

  it("navigates between years and formats the month in Portuguese", () => {
    expect(addCalendarMonths("2026-01", -1)).toBe("2025-12");
    expect(addCalendarMonths("2026-12", 1)).toBe("2027-01");
    expect(formatCalendarMonth("2026-09")).toBe("Setembro de 2026");
  });

  it("opens the nearest relevant month and date", () => {
    const visits = ["2026-08-20", "2026-10-03", "2026-10-12"];

    expect(getInitialCalendarMonth(visits, "2026-09-15")).toBe("2026-10");
    expect(getInitialCalendarDate(visits, "2026-10", "2026-09-15")).toBe("2026-10-03");
    expect(getInitialCalendarMonth([], "2026-09-15")).toBe("2026-09");
  });
});
