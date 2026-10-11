import { describe, expect, it } from "vitest";
import { createSystemClock } from "./system-clock.ts";

describe("system clock", () => {
  it("Given the system clock, When now is read, Then a Date is returned", () => {
    const clock = createSystemClock();
    expect(clock.now()).toBeInstanceOf(Date);
  });
});
