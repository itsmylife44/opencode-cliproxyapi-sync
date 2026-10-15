import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";
// ESM build: bundling the package's default UMD entry leaves a broken require("./impl/format") in dist.
import {
  applyEdits,
  modify,
  parseTree,
  type ParseError,
} from "jsonc-parser/lib/esm/main.js";
import type { Bundle } from "./sync";

export interface SyncDirs {
  configDir: string;
  omoDir: string;
}

export function getOmoDir(): string {
  return join(homedir(), ".omo");
}

export function getOpenCodeConfigDir(): string {
  // OCX sets OPENCODE_CONFIG_DIR when using profiles (e.g. ~/.config/opencode/profiles/spam/)
  const ocxConfigDir = process.env.OPENCODE_CONFIG_DIR;
  if (ocxConfigDir) {
    return ocxConfigDir;
  }
  
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "opencode");
  }
  return join(homedir(), ".config", "opencode");
}

/**
 * Resolve which opencode config file to write.
 * - Under OCX (OPENCODE_CONFIG_DIR set): prefer opencode.jsonc if it exists
 * - Otherwise: always opencode.json
 */
export function resolveOpencodeConfigPath(configDir: string): string {
  const isOcx = !!process.env.OPENCODE_CONFIG_DIR;
  if (isOcx) {
    const jsoncPath = join(configDir, "opencode.jsonc");
    if (existsSync(jsoncPath)) {
      return jsoncPath;
    }
  }
  return join(configDir, "opencode.json");
}

export async function writeConfigAtomic(
  filePath: string,
  content: string
): Promise<void> {
  const tempPath = `${filePath}.cliproxy-sync.tmp`;

  writeFileSync(tempPath, content, "utf-8");

  renameSync(tempPath, filePath);
}

/** OMO reads omo.jsonc, falling back to omo.json; write whichever it reads. */
function resolveOmoConfigPath(omoDir: string): string {
  const jsoncPath = join(omoDir, "omo.jsonc");
  const jsonPath = join(omoDir, "omo.json");
  return !existsSync(jsoncPath) && existsSync(jsonPath) ? jsonPath : jsoncPath;
}

function withOpencodeBlock(
  path: string,
  existing: string,
  block: Record<string, unknown>
): string {
  const errors: ParseError[] = [];
  const root = parseTree(existing, errors, { allowTrailingComma: true });
  // Empty or comment-only files have no root; modify() creates the object.
  if (root && (root.type !== "object" || errors.length > 0)) {
    throw new Error(`${path} is not a valid JSONC object; fix or remove it to sync`);
  }
  const edits = modify(existing, ["[opencode]"], block, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
  });
  return applyEdits(existing, edits);
}

function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

/**
 * Writes every config in the bundle. Legacy oh-my-opencode(-slim).json files are never touched.
 * Every file is rendered before any is written, so a bad omo.jsonc aborts the whole sync.
 * Returns the paths of files that existed before and whose content changed.
 */
export async function applyBundle(
  bundle: Bundle,
  dirs: SyncDirs
): Promise<string[]> {
  const writes: Array<{ path: string; existing: string | null; content: string }> = [];
  const add = (path: string, render: (existing: string) => string) => {
    const existing = readIfExists(path);
    writes.push({ path, existing, content: render(existing ?? "") });
  };

  const { opencode, ohMyOpencode, ohMyOpenCodeSlim } = bundle;
  add(resolveOpencodeConfigPath(dirs.configDir), () =>
    JSON.stringify(opencode, null, 2)
  );
  if (ohMyOpencode) {
    const omoPath = resolveOmoConfigPath(dirs.omoDir);
    add(omoPath, (existing) =>
      withOpencodeBlock(omoPath, existing, ohMyOpencode)
    );
  }
  if (ohMyOpenCodeSlim) {
    add(join(dirs.configDir, "oh-my-opencode-slim.jsonc"), () =>
      JSON.stringify(ohMyOpenCodeSlim, null, 2)
    );
  }

  if (ohMyOpencode) {
    mkdirSync(dirs.omoDir, { recursive: true });
  }
  const changed: string[] = [];
  for (const { path, existing, content } of writes) {
    await writeConfigAtomic(path, content);
    if (existing !== null && existing !== content) {
      changed.push(path);
    }
  }
  return changed;
}
