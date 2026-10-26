# TODO

Roadmap for Dyno Music. Suggested order: the **Essentials** first (the app is not usable day to day without them), then the **Now playing** view and per-song colours, then **Desktop integration**.

## Done

- [x] Hidden YouTube Music window as the playback engine, with an injected bridge script
- [x] Rust hub: player state, InnerTube requests, remote capability limited to `bridge_*`
- [x] Google sign-in through Google's page, session detected from cookies
- [x] Vue 3 + Tailwind CSS 4 UI: sidebar, search (Ctrl K), ambient artwork background, floating player island
- [x] Search and play, pause, previous/next, seek and volume

## Essentials

- [x] **Home recommendations**: "For you", "Recently played" and mixes from the account, as carousels
- [x] **Library**: liked songs, playlists, albums and artists; playlists listed in the sidebar
- [x] **Album, artist and playlist pages**
- [x] **Queue**: see what's next, reorder, remove, "play next"
- [x] **Full search**: tabs for songs, albums, artists and playlists, plus suggestions while typing
- [x] **Track actions**: like / dislike, add to playlist, right-click menu
- [x] **Repeat and shuffle**
- [x] **Never pause on its own**: dismiss YouTube Music's "Still listening?" prompt, which nobody sees in the hidden window

## Look and feel

- [ ] **Full-screen "Now playing" view**: the player island expands, with large artwork
- [ ] **Per-song colour**: the app's accent follows the artwork's colours
- [ ] **Synced lyrics**, line by line, in the "Now playing" view
- [ ] **Mini player**: the island floating on its own outside the window, always on top
- [ ] **Custom title bar**, without the standard window frame
- [ ] **Dyno identity**: an original logo or character for empty and loading screens
- [ ] **Light theme** and a **reduced-motion** mode

## Desktop integration

- [ ] **Tray icon**, and closing to the tray without stopping the music
- [ ] **Media keys** and the system media panel (Windows SMTC, macOS Now Playing, Linux MPRIS)
- [ ] **Discord Rich Presence**: "Listening to…" with artwork and progress
- [ ] **Single instance**, remember window size and position, launch at login, configurable shortcuts

## Settings and extras

- [ ] **Settings screen**: Discord on/off, close to tray, audio quality, show the YouTube Music window for debugging
- [ ] **Last.fm scrobbling**
- [ ] **Listening history**

## Performance and releases

- [ ] **Lighten the hidden page**: hide YouTube Music's own UI with CSS, then measure usage during playback
- [ ] **Cache** artwork and lists so revisiting a page is instant
- [ ] **Installers** for Windows, macOS and Linux with GitHub Actions, plus **auto-updates**
