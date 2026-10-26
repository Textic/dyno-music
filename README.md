# Dyno Music

A lightweight, unofficial YouTube Music desktop client built with [Tauri 2](https://tauri.app), Vue 3, Tailwind CSS 4 and TypeScript.

## Why this exists

Dyno Music is a personal project. I built it for myself, so it follows my own needs and taste rather than trying to fit everyone: a clean, distraction-free way to listen to music that also looks good. Features get added when I need them, though I'm also open to the occasional idea from outside, and the design choices are mine. You're welcome to use it, fork it or borrow ideas from it, but expect it to stay opinionated.

## How it works

Dyno Music is a hybrid client:

- A **hidden window** loads `music.youtube.com` and acts as the playback engine. It uses your own session (including Premium) and makes the requests to YouTube Music's internal API.
- A small script injected into that page (`src/bridge`) controls the player and reports its state.
- **Rust** is the hub. It relays commands and state between the page and the app's own UI.
- The **UI** (`src/main`) is entirely custom.

The page can only call the `bridge_*` commands (`src-tauri/capabilities/ytm-remote.json`). It never gets file system or shell access.

## Status

Early development. Working today, all from the app's own interface:

- Google sign-in, home recommendations, and your library (playlists, liked songs, albums, artists)
- album, playlist and artist pages; search with filters and suggestions
- playback controls, repeat, shuffle, likes, and a queue you can reorder
- play next / add to queue / add to playlist from a right-click menu
- a full-screen "Now playing" view, a custom title bar, listening history and settings
- tray icon (keeps playing when the window is closed) and media keys / system media controls

See [TODO.md](TODO.md) for what comes next.

## Development

Requirements: the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform, plus Node.js.

```bash
npm install
npm run tauri dev
```

## Releases and updates

Every merge into `main` releases a new version through [the release workflow](.github/workflows/release.yml):

1. If the PR didn't change the version, it bumps the patch number (0.1.0 → 0.1.1) and commits that to `main`. To release a bigger step, bump it in the PR: `node scripts/bump-version.mjs minor` (or `major`, or an exact version).
2. It builds installers for Windows (MSI, NSIS), macOS (Apple Silicon and Intel) and Linux (AppImage, deb, rpm).
3. Once every build has passed, it publishes the GitHub Release.

Changes that only touch Markdown files don't create a version. Installed copies update themselves from the latest release; updates are signed and checked against the public key in `src-tauri/tauri.conf.json`.

The workflow needs the `TAURI_SIGNING_PRIVATE_KEY` repository secret (the private half of the update key). The builds aren't code-signed, so Windows SmartScreen and macOS Gatekeeper warn on first install.

## Project layout

| Path | Purpose |
|---|---|
| `src/main` | App UI (Vue 3 + Tailwind CSS 4, Pinia, Vue Router) |
| `src/bridge` | Script injected into music.youtube.com (built to `dist-bridge/bridge.js`) |
| `src/shared` | Types, IPC wrappers, and the InnerTube model and parsers |
| `src-tauri/src` | Rust hub: player window, shared state, commands |

## Inspiration

Dyno Music aims for its own look, but it draws on these projects:

- **[Zuno](https://github.com/noFAYZ/zuno)**: a Tauri + React YouTube Music client with a fully custom UI. It inspired the layout (sidebar library, search, home shelves, queue) and the sign-in flow: opening Google's sign-in page and detecting the session from its cookies.
- **[Glassy Music](https://github.com/NanKillBro/glassy-music-nankill)**: a heavily restyled build of Pear Desktop. It inspired the ambient background taken from the album artwork and the translucent "glass" surfaces.
- **[Pear Desktop](https://github.com/pear-devs/pear-desktop)** (formerly th-ch/youtube-music): the long-running YouTube Music desktop app. It showed how far you can go by running music.youtube.com itself and extending it with injected scripts.

No code is copied from these projects; all credit for their ideas goes to their authors.

## Disclaimer

This is an unofficial personal project. It is not affiliated with or endorsed by Google or YouTube, and it relies on undocumented APIs that may change at any time.
