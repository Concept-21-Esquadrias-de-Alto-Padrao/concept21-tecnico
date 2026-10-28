import { describe,it,expect } from "vitest";
import { receiptDueAt } from "./commercial-receipt";
describe("commercial receipt due date",()=>{
 it("skips weekends and configured holidays, keeping 17:30 Brasilia",()=>{expect(receiptDueAt(new Date("2026-10-09T22:00:00Z"),["2026-10-12"])).toBe("2026-10-13T17:30:00-03:00");});
 it("uses the local receipt day rather than UTC day",()=>{expect(receiptDueAt(new Date("2026-10-29T01:00:00Z"),[])).toBe("2026-10-29T17:30:00-03:00");});
});
