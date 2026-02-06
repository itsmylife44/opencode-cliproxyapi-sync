import type { Plugin } from "@opencode-ai/plugin";
import { join } from "path";
import { loadPluginConfig, savePluginConfig } from "./config";
import { checkVersion, fetchBundle } from "./sync";
import {
  getOpenCodeConfigDir,
  writeConfigAtomic,
  readFileHash,
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
    const opencodeConfigPath = join(configDir, "opencode.json");
    const ohMyConfigPath = join(configDir, "oh-my-opencode.json");

    const oldOpencodeHash = await readFileHash(opencodeConfigPath);

    await writeConfigAtomic(
      opencodeConfigPath,
      JSON.stringify(bundle.opencode, null, 2)
    );
    if (bundle.ohMyOpencode) {
      await writeConfigAtomic(
        ohMyConfigPath,
        JSON.stringify(bundle.ohMyOpencode, null, 2)
      );
    }

    const newOpencodeHash = await readFileHash(opencodeConfigPath);

    if (oldOpencodeHash !== null && oldOpencodeHash !== newOpencodeHash) {
      ctx.client.tui.showToast({
        body: {
          title: "Config Sync",
          message:
            "opencode.json updated. Restart OpenCode to apply provider changes.",
          variant: "warning",
          duration: 8000,
        },
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

export default ConfigSyncPlugin;
