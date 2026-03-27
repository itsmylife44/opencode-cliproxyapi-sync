import { describe, expect, it } from "bun:test";
import type { Bundle } from "./sync";

describe("Bundle interface", () => {
  it("accepts a bundle with ohMyOpenCodeSlim", () => {
    const bundle: Bundle = {
      version: "abc123",
      opencode: { $schema: "https://opencode.ai/config.json" },
      ohMyOpencode: { agents: {} },
      ohMyOpenCodeSlim: { agents: { orchestrator: { model: "cliproxyapi/claude-opus-4-6" } } },
    };
    expect(bundle.ohMyOpenCodeSlim).toBeTruthy();
    expect(bundle.version).toBe("abc123");
  });

  it("accepts a bundle with null slim config", () => {
    const bundle: Bundle = {
      version: "def456",
      opencode: {},
      ohMyOpencode: null,
      ohMyOpenCodeSlim: null,
    };
    expect(bundle.ohMyOpenCodeSlim).toBeNull();
  });
});
