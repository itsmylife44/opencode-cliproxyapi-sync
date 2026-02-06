import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";
import { createHash } from "crypto";
import { homedir } from "os";
import { join } from "path";

export function getOpenCodeConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "opencode");
  }
  return join(homedir(), ".config", "opencode");
}

export async function writeConfigAtomic(
  filePath: string,
  content: string
): Promise<void> {
  const tempPath = `${filePath}.cliproxy-sync.tmp`;

  writeFileSync(tempPath, content, "utf-8");

  renameSync(tempPath, filePath);
}

export async function readFileHash(filePath: string): Promise<string | null> {
  try {
    if (!existsSync(filePath)) {
      return null;
    }

    const content = readFileSync(filePath, "utf-8");
    const hash = createHash("sha256");
    hash.update(content);
    return hash.digest("hex");
  } catch (error) {
    console.error(`[cliproxyapi-sync] Failed to hash ${filePath}:`, error);
    return null;
  }
}
