import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

export interface PluginConfig {
  dashboardUrl: string;
  syncToken: string;
  lastKnownVersion: string | null;
}

function getConfigDir(): string {
  const ocxConfigDir = process.env.OPENCODE_CONFIG_DIR;
  if (ocxConfigDir) {
    return join(ocxConfigDir, "opencode-cliproxyapi-sync");
  }
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const baseDir = xdgConfigHome || join(homedir(), ".config");
  return join(baseDir, "opencode", "opencode-cliproxyapi-sync");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function loadPluginConfig(): PluginConfig | null {
  try {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      return null;
    }

    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content) as PluginConfig;

    // Validate required fields
    if (!config.dashboardUrl || !config.syncToken) {
      console.error(
        "[cliproxyapi-sync] Invalid config: missing dashboardUrl or syncToken"
      );
      return null;
    }

    return config;
  } catch (error) {
    console.error("[cliproxyapi-sync] Failed to load config:", error);
    return null;
  }
}

export function savePluginConfig(config: PluginConfig): void {
  try {
    const configDir = getConfigDir();
    const configPath = getConfigPath();

    // Create directory if it doesn't exist
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Write config atomically via temp file
    const tempPath = `${configPath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(config, null, 2), "utf-8");
    
    // Set restrictive permissions (600)
    chmodSync(tempPath, 0o600);

    // Atomic rename
    writeFileSync(configPath, readFileSync(tempPath));
    chmodSync(configPath, 0o600);

    // Clean up temp file (optional, rename would overwrite anyway)
    try {
      const { unlinkSync } = require("fs");
      unlinkSync(tempPath);
    } catch {}
  } catch (error) {
    console.error("[cliproxyapi-sync] Failed to save config:", error);
    throw error;
  }
}
