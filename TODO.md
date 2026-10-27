# TODO

What's left for Dyno Music. Finished work lives in the git history and the release notes.

## Look and feel

- [ ] **Per-song colour**: the app's accent follows the artwork's colours
- [ ] **Synced lyrics**, line by line, in the "Now playing" view
- [ ] **Light theme** and a **reduced-motion** mode

## Settings and extras

- [ ] **Audio quality** setting

## Distribution

- [ ] **Signed Windows installer** through SignPath Foundation, so SmartScreen stops warning about an unknown publisher. Applied on 2026-10-26; waiting for their answer. Once approved: store the SignPath token as a secret and sign the installer from the release workflow through Tauri's `signCommand`, so the updater's `.sig` is made from the signed file
- [ ] **winget package** (`Textic.DynoMusic`): first submission by hand with `wingetcreate new <setup.exe URL>`, then a `winget-releaser` job in the release workflow for later versions (needs a fork of `microsoft/winget-pkgs` and a `WINGET_TOKEN` secret)

## Testing

- [ ] **Try the keyboard shortcuts** by hand, especially a global one used from another app
- [ ] **Try ad skipping** (Settings → Playback) with an account without Premium: ads should be silent and gone within a second

## Performance

- [ ] **Measure usage during playback** (CPU and memory of the hidden YouTube Music window)
