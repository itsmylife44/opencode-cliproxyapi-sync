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

Add to your `opencode.jsonc` plugin array:

```json
{
  "plugin": [
    "opencode-cliproxyapi-sync@latest",
    "oh-my-opencode@latest"
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

Create the config file in the **same directory** as your `opencode.json`:

**Standard location:**
```
~/.config/opencode/opencode-cliproxyapi-sync/config.json
```

**With OCX profile:**
```
~/.config/opencode/profiles/<profilename>/opencode-cliproxyapi-sync/config.json
```

**Config content:**
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

**Standard (no profile):**
- **Plugin Config**: `~/.config/opencode/opencode-cliproxyapi-sync/config.json`
- **OpenCode Config**: `~/.config/opencode/opencode.json`
- **Oh My OpenCode Config**: `~/.config/opencode/oh-my-opencode.json`

**With OCX profile:**
- **Plugin Config**: `~/.config/opencode/profiles/<name>/opencode-cliproxyapi-sync/config.json`
- **OpenCode Config**: `~/.config/opencode/profiles/<name>/opencode.json`
- **Oh My OpenCode Config**: `~/.config/opencode/profiles/<name>/oh-my-opencode.json`

(Respects `XDG_CONFIG_HOME` and `OPENCODE_CONFIG_DIR` environment variables)

## OCX Profile Support

When using [OCX](https://github.com/kdcokenny/ocx) profiles, the plugin uses **per-profile configuration**. This means:

1. **Each profile has its own plugin config** - you can sync different profiles to different dashboards or disable sync for some profiles
2. **Syncing only affects the active profile** - starting `ocx oc -p work` will only update configs in the `work` profile directory
3. **No cross-profile interference** - the standard config is never touched when using a profile

**Setup for OCX profiles:**
```bash
# Create config for your profile
mkdir -p ~/.config/opencode/profiles/myprofile/opencode-cliproxyapi-sync
cat > ~/.config/opencode/profiles/myprofile/opencode-cliproxyapi-sync/config.json << 'EOF'
{
  "dashboardUrl": "https://dashboard.yourdomain.com",
  "syncToken": "your-token-here",
  "lastKnownVersion": null
}
EOF

# Now start with profile - only this profile syncs
ocx oc -p myprofile
```

**Disable sync for a profile:** Simply don't create a `config.json` in that profile's `opencode-cliproxyapi-sync` folder.

## Troubleshooting

### Plugin doesn't sync

**Check config file exists and is valid**:
```bash
# Standard location
cat ~/.config/opencode/opencode-cliproxyapi-sync/config.json

# Or with OCX profile
cat ~/.config/opencode/profiles/<profilename>/opencode-cliproxyapi-sync/config.json
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
