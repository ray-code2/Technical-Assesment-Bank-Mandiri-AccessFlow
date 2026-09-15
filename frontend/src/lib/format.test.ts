import { describe, expect, it } from "vitest";
import { statusLabel } from "./format";

describe("statusLabel", () => {
  it("shows the current approval stage while a request is in progress", () => {
    expect(statusLabel("IN_PROGRESS", "MANAGER")).toBe("Waiting for manager");
    expect(statusLabel("IN_PROGRESS", "ADMIN")).toBe("Waiting for admin");
  });

  it("shows final status labels", () => {
    expect(statusLabel("APPROVED", "COMPLETE")).toBe("Approved");
    expect(statusLabel("REJECTED", "COMPLETE")).toBe("Rejected");
    expect(statusLabel("CANCELLED", "COMPLETE")).toBe("Withdrawn");
  });
});

