import { describe, expect, it, vi } from "vitest";
import { handleTowerTrainingReport } from "./get-tower-training-report.ts";

const { report } = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock("../di.ts", () => ({ createApp: async () => ({ getTowerTrainingReport: report }) }));
describe("tower training evidence", () => {
  it("Given an unavailable bundle, When training evidence is requested, Then no curve is invented", async () => {
    report.mockReturnValue(null);
    expect(await handleTowerTrainingReport()).toBeNull();
  });
});
