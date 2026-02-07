# opencode-cliproxyapi-sync

Auto-sync OpenCode configs from CLIProxyAPI Dashboard.

## What it does

This plugin automatically syncs your OpenCode configuration (`opencode.json` and `oh-my-opencode.json`) from the CLIProxyAPI Dashboard. It checks for config updates on OpenCode startup and applies them automatically.

## Features

- 🔄 **Automatic Sync**: Checks for config updates on OpenCode startup
- ⚡ **Fast**: Only syncs when configs actually change (version-based)
- 🔒 **Secure**: Uses sync tokens for authentication
- 📝 **Smart Notifications**: Only shows toast when `opencode.json` changes (requiring restart)
- 💾 **Atomic Writes**: Safe config file updates (no partial writes)

## Installation

### Option 1: NPX Install (Recommended)

```bash
npx opencode install opencode-cliproxyapi-sync
```

### Option 2: Manual Configuration

Add to your `~/.config/opencode/opencode.json` plugins array:

```json
{
  "plugin": [
    "opencode-cliproxyapi-sync",
    "oh-my-opencode@latest",
    "..."
  ]
}
```

**Important**: Place `opencode-cliproxyapi-sync` **before** `oh-my-opencode` in the plugins array to ensure config is synced before oh-my-opencode loads.

## Setup

### 1. Generate Sync Token

1. Open the CLIProxyAPI Dashboard
2. Navigate to **Settings** → **Config Sync**
3. Click **Generate Sync Token**
4. Copy the token (it starts with `tok_...`)

### 2. Create Plugin Config File

Create the config file at `~/.config/opencode-cliproxyapi-sync/config.json`:

```json
{
  "dashboardUrl": "https://dashboard.yourdomain.com",
  "syncToken": "tok_abc123...",
  "lastKnownVersion": null
}
```

**Config Fields**:
- `dashboardUrl`: Your CLIProxyAPI Dashboard URL (no trailing slash)
- `syncToken`: The sync token from Step 1
- `lastKnownVersion`: Leave as `null` (plugin manages this automatically)

**Security**: The plugin automatically sets restrictive permissions (chmod 600) on the config file.

## How it works

1. **On OpenCode Startup**: Plugin loads and checks your config
2. **Version Check**: Fetches current config version from dashboard
3. **Compare**: If version differs from `lastKnownVersion`, fetches full bundle
4. **Write Configs**: Atomically writes `opencode.json` and `oh-my-opencode.json`
5. **Notify**: Shows toast if `opencode.json` changed (requiring restart)
6. **Update Version**: Saves new version to plugin config

## Configuration Sync Behavior

- **Sync Timing**: Only on OpenCode startup (not while running)
- **Network Timeout**: 5s for version check, 10s for bundle download
- **Retries**: Up to 2 retries with exponential backoff (1s, 2s)
- **Error Handling**: All errors logged but never crash OpenCode

## Notifications

The plugin shows a toast notification **only when** `opencode.json` changes:

> ⚠️ **Config Sync**  
> opencode.json updated. Restart OpenCode to apply provider changes.

If only `oh-my-opencode.json` changes, no notification is shown (those changes apply immediately on next session).

## File Locations

- **Plugin Config**: `~/.config/opencode-cliproxyapi-sync/config.json`
- **OpenCode Config**: `~/.config/opencode/opencode.json`
- **Oh My OpenCode Config**: `~/.config/opencode/oh-my-opencode.json`

(Respects `XDG_CONFIG_HOME` environment variable if set)

## OCX Profile Support

When using [OCX](https://github.com/kdcokenny/ocx) profiles, the plugin automatically detects the profile directory via the `OPENCODE_CONFIG_DIR` environment variable that OCX sets.

This means configs are synced to the correct profile location:
- **Without profile**: `~/.config/opencode/opencode.json`
- **With profile**: `~/.config/opencode/profiles/<name>/opencode.json`

No additional configuration needed - just use `ocx oc -p myprofile` as usual.

## Troubleshooting

### Plugin doesn't sync

**Check config file exists and is valid**:
```bash
cat ~/.config/opencode-cliproxyapi-sync/config.json
```

**Check OpenCode logs** for sync messages:
```bash
# Look for lines like:
[cliproxyapi-sync] Synced to version abc123...
[cliproxyapi-sync] Failed to check version. Skipping sync.
```

### Authentication errors (401)

- Verify your `syncToken` is correct
- Check if token was revoked in Dashboard → Settings → Config Sync
- Generate a new token if needed

### Config not updating

- Ensure dashboard URL is correct (no trailing slash)
- Check firewall/network allows access to dashboard
- Verify dashboard is running and accessible

### Notification not showing

- Notification only appears when `opencode.json` changes
- If only `oh-my-opencode.json` changed, no notification is shown (expected)

## Development

### Build from source

```bash
cd plugin
bun install
bun build src/index.ts --outdir dist --target node
```

### Local testing

1. Build the plugin (see above)
2. Link locally:
   ```bash
   cd plugin
   npm link
   cd ~/.config/opencode
   npm link opencode-cliproxyapi-sync
   ```
3. Add `"opencode-cliproxyapi-sync"` to your `opencode.json` plugins array
4. Restart OpenCode

## License

MIT

## Support

- **Dashboard Issues**: https://github.com/itsmylife44/opencode-cliproxyapi-sync/issues
- **CLIProxyAPI**: https://github.com/router-for-me/CLIProxyAPI
- **OpenCode**: https://opencode.ai
