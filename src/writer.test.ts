import { beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parse, type ParseError } from "jsonc-parser";
import type { Bundle } from "./sync";
import { applyBundle } from "./writer";

const omoConfig = { agents: { sisyphus: { model: "cliproxyapi/claude-opus-4-6" } } };

function bundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    version: "v1",
    opencode: { $schema: "https://opencode.ai/config.json" },
    ohMyOpencode: null,
    ohMyOpenCodeSlim: null,
    ...overrides,
  };
}

describe("applyBundle", () => {
  let configDir: string;
  let omoDir: string;

  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), "cliproxy-sync-"));
    configDir = join(root, "opencode");
    omoDir = join(root, ".omo");
    mkdirSync(configDir);
  });

  it("writes opencode.json", async () => {
    await applyBundle(bundle(), { configDir, omoDir });
    const written = JSON.parse(readFileSync(join(configDir, "opencode.json"), "utf-8"));
    expect(written).toEqual({ $schema: "https://opencode.ai/config.json" });
  });

  it("replaces only the [opencode] block of an existing omo.jsonc", async () => {
    mkdirSync(omoDir);
    const head = `// OMO configuration\n{\n  "$schema": "https://example.com/omo.schema.json",\n  "[opencode]": `;
    const tail = `,\n  // native harness\n  "[native]": { "agents": { "x": { "model": "a/b" } } }, /* keep */\n  "models": {}\n}\n`;
    writeFileSync(join(omoDir, "omo.jsonc"), `${head}{ "agents": { "old": {} } }${tail}`);

    await applyBundle(bundle({ ohMyOpencode: omoConfig }), { configDir, omoDir });

    const result = readFileSync(join(omoDir, "omo.jsonc"), "utf-8");
    expect(result.startsWith(head)).toBe(true);
    expect(result.endsWith(tail)).toBe(true);
    expect(parse(result)["[opencode]"]).toEqual(omoConfig);
  });

  it("creates ~/.omo/omo.jsonc with an [opencode] block when missing", async () => {
    await applyBundle(bundle({ ohMyOpencode: omoConfig }), { configDir, omoDir });

    const errors: ParseError[] = [];
    const result = parse(readFileSync(join(omoDir, "omo.jsonc"), "utf-8"), errors);
    expect(errors).toEqual([]);
    expect(result).toEqual({ "[opencode]": omoConfig });
  });

  it("writes into omo.json when that is the file OMO reads", async () => {
    mkdirSync(omoDir);
    writeFileSync(join(omoDir, "omo.json"), `{ "models": {} }`);

    await applyBundle(bundle({ ohMyOpencode: omoConfig }), { configDir, omoDir });

    expect(existsSync(join(omoDir, "omo.jsonc"))).toBe(false);
    expect(parse(readFileSync(join(omoDir, "omo.json"), "utf-8"))).toEqual({
      models: {},
      "[opencode]": omoConfig,
    });
  });

  for (const corrupt of ["{ broken", `{"a":1,,}`, "[]"]) {
    it(`refuses to touch any file when omo.jsonc is ${corrupt}`, async () => {
      mkdirSync(omoDir);
      writeFileSync(join(omoDir, "omo.jsonc"), corrupt);

      await expect(
        applyBundle(bundle({ ohMyOpencode: omoConfig }), { configDir, omoDir })
      ).rejects.toThrow(/omo\.jsonc/);

      expect(readFileSync(join(omoDir, "omo.jsonc"), "utf-8")).toBe(corrupt);
      expect(existsSync(join(configDir, "opencode.json"))).toBe(false);
    });
  }

  it("writes slim config to oh-my-opencode-slim.jsonc", async () => {
    const slim = { agents: { orchestrator: { model: "cliproxyapi/claude-opus-4-6" } } };
    await applyBundle(bundle({ ohMyOpenCodeSlim: slim }), { configDir, omoDir });

    const written = parse(readFileSync(join(configDir, "oh-my-opencode-slim.jsonc"), "utf-8"));
    expect(written).toEqual(slim);
  });

  it("leaves legacy oh-my-opencode.json and oh-my-opencode-slim.json untouched", async () => {
    writeFileSync(join(configDir, "oh-my-opencode.json"), "legacy omo");
    writeFileSync(join(configDir, "oh-my-opencode-slim.json"), "legacy slim");

    await applyBundle(
      bundle({ ohMyOpencode: omoConfig, ohMyOpenCodeSlim: { agents: {} } }),
      { configDir, omoDir }
    );

    expect(readFileSync(join(configDir, "oh-my-opencode.json"), "utf-8")).toBe("legacy omo");
    expect(readFileSync(join(configDir, "oh-my-opencode-slim.json"), "utf-8")).toBe("legacy slim");
  });

  it("reports which existing files changed", async () => {
    const first = await applyBundle(bundle({ ohMyOpencode: omoConfig }), { configDir, omoDir });
    expect(first).toEqual([]);

    const changed = await applyBundle(
      bundle({ opencode: { plugin: [] }, ohMyOpencode: omoConfig }),
      { configDir, omoDir }
    );
    expect(changed).toEqual([join(configDir, "opencode.json")]);
  });
});
