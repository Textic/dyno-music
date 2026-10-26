# Dyno Music

A lightweight YouTube Music desktop client built with [Tauri 2](https://tauri.app), Vue 3, Tailwind CSS 4 and TypeScript.

## How it works

Dyno Music is a hybrid client:

- A **hidden window** loads `music.youtube.com` and acts as the playback engine. It uses your own session (including Premium) and makes the requests to YouTube Music's internal API.
- A small script injected into that page (`src/bridge`) controls the player and reports its state.
- **Rust** is the hub. It relays commands and state between the page and the app's own UI.
- The **UI** (`src/main`) is entirely custom.

The page can only call the `bridge_*` commands (`src-tauri/capabilities/ytm-remote.json`). It never gets file system or shell access.

## Status

Phase 0: proof of concept. The test page can search, play and pause through the hidden player, and it shows diagnostics on how the hidden page behaves.

Planned next:

- full UI (home, library, playlists, queue)
- tray icon and media keys
- mini player
- Discord Rich Presence
- Windows, macOS and Linux builds

## Development

Requirements: the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform, plus Node.js.

```bash
npm install
npm run tauri dev
```

## Project layout

| Path | Purpose |
|---|---|
| `src/main` | App UI (Vue 3 + Tailwind CSS 4, Pinia, Vue Router) |
| `src/bridge` | Script injected into music.youtube.com (built to `dist-bridge/bridge.js`) |
| `src/shared` | Types, IPC wrappers and InnerTube response parsers |
| `src-tauri/src` | Rust hub: player window, shared state, commands |

## Disclaimer

This is an unofficial personal project. It is not affiliated with or endorsed by Google or YouTube, and it relies on undocumented APIs that may change at any time.
