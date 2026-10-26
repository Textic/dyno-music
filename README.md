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

Early development. Working today, all from the app's own interface:

- Google sign-in, home recommendations, and your library (playlists, liked songs, albums, artists)
- album, playlist and artist pages; search with filters and suggestions
- playback controls, repeat, shuffle, likes, and a queue you can reorder
- play next / add to queue / add to playlist from a right-click menu

See [TODO.md](TODO.md) for what comes next.

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
