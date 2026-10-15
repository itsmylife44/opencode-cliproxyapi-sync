import type { Plugin } from "@opencode-ai/plugin";
import { loadPluginConfig, savePluginConfig } from "./config";
import { checkVersion, fetchBundle } from "./sync";
import {
  applyBundle,
  getOmoDir,
  getOpenCodeConfigDir,
  resolveOpencodeConfigPath,
} from "./writer";

const ConfigSyncPlugin: Plugin = async (ctx) => {
  try {
    const config = loadPluginConfig();
    if (!config || !config.syncToken || !config.dashboardUrl) {
      console.log("[cliproxyapi-sync] No config found. Skipping sync.");
      return {};
    }

    const versionResult = await checkVersion(
      config.dashboardUrl,
      config.syncToken
    );
    if (!versionResult) {
      console.error(
        "[cliproxyapi-sync] Failed to check version. Skipping sync."
      );
      return {};
    }

    if (versionResult.version === config.lastKnownVersion) {
      return {};
    }

    const bundle = await fetchBundle(config.dashboardUrl, config.syncToken);
    if (!bundle) {
      console.error(
        "[cliproxyapi-sync] Failed to fetch bundle. Skipping sync."
      );
      return {};
    }

    const configDir = getOpenCodeConfigDir();
    const changed = await applyBundle(bundle, {
      configDir,
      omoDir: getOmoDir(),
    });

    config.lastKnownVersion = bundle.version;
    savePluginConfig(config);

    if (changed.includes(resolveOpencodeConfigPath(configDir))) {
      setTimeout(() => {
        ctx.client.tui.showToast({
          body: {
            title: "CLIProxyAPI Config Updated",
            message: "Restart OpenCode to apply changes",
            variant: "warning",
            duration: 8000,
          },
        });
      }, 1000);
    }

    console.log(`[cliproxyapi-sync] Synced to version ${bundle.version}`);
  } catch (error) {
    console.error("[cliproxyapi-sync] Sync error:", error);
  }

  return {};
};

export default ConfigSyncPlugin;
