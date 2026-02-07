import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/index.ts
import { join as join3 } from "path";

// src/config.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "fs";
import { homedir } from "os";
import { join } from "path";
function getConfigDir() {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const baseDir = xdgConfigHome || join(homedir(), ".config");
  return join(baseDir, "opencode-cliproxyapi-sync");
}
function getConfigPath() {
  return join(getConfigDir(), "config.json");
}
function loadPluginConfig() {
  try {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      return null;
    }
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);
    if (!config.dashboardUrl || !config.syncToken) {
      console.error("[cliproxyapi-sync] Invalid config: missing dashboardUrl or syncToken");
      return null;
    }
    return config;
  } catch (error) {
    console.error("[cliproxyapi-sync] Failed to load config:", error);
    return null;
  }
}
function savePluginConfig(config) {
  try {
    const configDir = getConfigDir();
    const configPath = getConfigPath();
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    const tempPath = `${configPath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(config, null, 2), "utf-8");
    chmodSync(tempPath, 384);
    writeFileSync(configPath, readFileSync(tempPath));
    chmodSync(configPath, 384);
    try {
      const { unlinkSync } = __require("fs");
      unlinkSync(tempPath);
    } catch {}
  } catch (error) {
    console.error("[cliproxyapi-sync] Failed to save config:", error);
    throw error;
  }
}

// src/sync.ts
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function retryFetch(fetcher, maxRetries = 2) {
  const delays = [1000, 2000];
  for (let attempt = 0;attempt <= maxRetries; attempt++) {
    try {
      return await fetcher();
    } catch (error) {
      if (attempt === maxRetries) {
        return null;
      }
      const delay = delays[attempt] || 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
}
async function checkVersion(dashboardUrl, token) {
  return retryFetch(async () => {
    const url = `${dashboardUrl}/api/config-sync/version`;
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }, 5000);
    if (!response.ok) {
      if (response.status === 401) {
        console.error("[cliproxyapi-sync] Invalid or revoked sync token (401)");
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  });
}
async function fetchBundle(dashboardUrl, token) {
  return retryFetch(async () => {
    const url = `${dashboardUrl}/api/config-sync/bundle`;
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }, 1e4);
    if (!response.ok) {
      if (response.status === 401) {
        console.error("[cliproxyapi-sync] Invalid or revoked sync token (401)");
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  });
}

// src/writer.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2, renameSync } from "fs";
import { createHash } from "crypto";
import { homedir as homedir2 } from "os";
import { join as join2 } from "path";
function getOpenCodeConfigDir() {
  const ocxConfigDir = process.env.OPENCODE_CONFIG_DIR;
  if (ocxConfigDir) {
    return ocxConfigDir;
  }
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join2(xdgConfigHome, "opencode");
  }
  return join2(homedir2(), ".config", "opencode");
}
async function writeConfigAtomic(filePath, content) {
  const tempPath = `${filePath}.cliproxy-sync.tmp`;
  writeFileSync2(tempPath, content, "utf-8");
  renameSync(tempPath, filePath);
}
async function readFileHash(filePath) {
  try {
    if (!existsSync2(filePath)) {
      return null;
    }
    const content = readFileSync2(filePath, "utf-8");
    const hash = createHash("sha256");
    hash.update(content);
    return hash.digest("hex");
  } catch (error) {
    console.error(`[cliproxyapi-sync] Failed to hash ${filePath}:`, error);
    return null;
  }
}

// src/index.ts
var ConfigSyncPlugin = async (ctx) => {
  try {
    const config = loadPluginConfig();
    if (!config || !config.syncToken || !config.dashboardUrl) {
      console.log("[cliproxyapi-sync] No config found. Skipping sync.");
      return {};
    }
    const versionResult = await checkVersion(config.dashboardUrl, config.syncToken);
    if (!versionResult) {
      console.error("[cliproxyapi-sync] Failed to check version. Skipping sync.");
      return {};
    }
    if (versionResult.version === config.lastKnownVersion) {
      return {};
    }
    const bundle = await fetchBundle(config.dashboardUrl, config.syncToken);
    if (!bundle) {
      console.error("[cliproxyapi-sync] Failed to fetch bundle. Skipping sync.");
      return {};
    }
    const configDir = getOpenCodeConfigDir();
    const opencodeConfigPath = join3(configDir, "opencode.json");
    const ohMyConfigPath = join3(configDir, "oh-my-opencode.json");
    const oldOpencodeHash = await readFileHash(opencodeConfigPath);
    await writeConfigAtomic(opencodeConfigPath, JSON.stringify(bundle.opencode, null, 2));
    if (bundle.ohMyOpencode) {
      await writeConfigAtomic(ohMyConfigPath, JSON.stringify(bundle.ohMyOpencode, null, 2));
    }
    const newOpencodeHash = await readFileHash(opencodeConfigPath);
    if (oldOpencodeHash !== null && oldOpencodeHash !== newOpencodeHash) {
      ctx.client.tui.showToast({
        body: {
          title: "Config Sync",
          message: "opencode.json updated. Restart OpenCode to apply provider changes.",
          variant: "warning",
          duration: 8000
        }
      });
    }
    config.lastKnownVersion = bundle.version;
    savePluginConfig(config);
    console.log(`[cliproxyapi-sync] Synced to version ${bundle.version}`);
  } catch (error) {
    console.error("[cliproxyapi-sync] Sync error:", error);
  }
  return {};
};
var src_default = ConfigSyncPlugin;
export {
  src_default as default
};
