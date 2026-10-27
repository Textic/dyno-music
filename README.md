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
- a mini player that stays on top of other windows
- Discord Rich Presence ("Listening to…"), which you can turn off in Settings
- keyboard shortcuts you can change, optionally working from any app
- optional ad skipping for accounts without Premium (off by default, in Settings)
- synced lyrics in the "Now playing" view, from YouTube Music itself or [LRCLIB](https://lrclib.net), whichever has the better version
- dark, light or system theme, an accent colour taken from each song's artwork, and a reduced-motion mode
- an audio quality setting (low, normal, or high with Premium)

See [TODO.md](TODO.md) for what comes next.

## Development

Requirements: the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform, plus Node.js.

```bash
npm install
npm run tauri dev
```

## Performance

`scripts/measure-usage.ps1` (Windows) measures the CPU and memory of Dyno Music and every WebView2 process it starts, while you use it:

```bash
pwsh scripts/measure-usage.ps1 -Seconds 30
```

Measured on 2026-10-27 while playing, with the main window open behind another window (16-core PC, debug build; CPU as a share of one core):

| | CPU | Memory |
|---|---|---|
| Hidden YouTube Music page (renderer) | 2.4% | 200 MB |
| Dyno Music's interface (renderer) | 0.6% | 87 MB |
| GPU process | 1.1% | 205 MB |
| Everything (10 processes, Rust app included) | 4.4% | 622 MB |

Before that measurement, the progress bar redrew on every screen frame while playing; the interface and the GPU then used 21% and 27% of a core. It now moves four times a second.

## Releases and updates

Every merge into `main` releases a new version through [the release workflow](.github/workflows/release.yml):

1. If the PR didn't change the version, it bumps the patch number (0.1.0 → 0.1.1) and commits that to `main`. To release a bigger step, bump it in the PR: `node scripts/bump-version.mjs minor` (or `major`, or an exact version).
2. It builds installers for Windows (MSI, NSIS), macOS (Apple Silicon and Intel) and Linux (AppImage, deb, rpm).
3. Once every build has passed, it publishes the GitHub Release.

Changes that only touch Markdown files don't create a version. Installed copies update themselves from the latest release; updates are signed and checked against the public key in `src-tauri/tauri.conf.json`.

The workflow needs the `TAURI_SIGNING_PRIVATE_KEY` repository secret (the private half of the update key). The builds aren't code-signed yet, so Windows SmartScreen and macOS Gatekeeper warn on first install (see [Code signing policy](#code-signing-policy)).

## Code signing policy

Windows releases are meant to be signed through the SignPath Foundation's program for open source projects. Signing isn't active yet; this section describes how it will work.

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

Only installers built by [the release workflow](.github/workflows/release.yml) from this repository's `main` branch get signed. No binaries from other projects are signed under this certificate.

Team roles:

- Committers and reviewers: [Textic](https://github.com/Textic)
- Approvers: [Textic](https://github.com/Textic)

## Privacy

Dyno Music has no analytics, telemetry or servers of its own. It connects only to:

- **YouTube Music and Google** (`music.youtube.com`, `accounts.google.com` and their media servers), to sign in and play music. This is the app's purpose, and it works like the YouTube Music website in a browser; Google's own [privacy policy](https://policies.google.com/privacy) applies. Your session stays on your computer, in the app's local WebView profile.
- **GitHub** (`github.com`), to check for and download updates of Dyno Music. GitHub sees your IP address and the request, as with any download.
- **Discord**, only if the Discord app is running and the Rich Presence setting is on (it is on by default; turn it off in Settings). Dyno Music sends the song you're playing to Discord on your computer, which shows it on your profile.
- **LRCLIB** (`lrclib.net`), only while the lyrics panel is open in "Now playing": Dyno Music sends the song's title, artist, album and length to look up its lyrics. LRCLIB is a free, open lyrics database; it sees your IP address and those details.

Settings are stored only on your computer; your listening history is the one YouTube Music keeps for your account. To remove Dyno Music, uninstall it from Windows Settings → Apps (or delete the app on macOS / remove the package on Linux).

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

## License

[MIT](LICENSE)
