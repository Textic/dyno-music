# TODO

What's left for Dyno Music. Finished work lives in the git history and the release notes.

## Distribution

- [ ] **Signed Windows installer** through SignPath Foundation, so SmartScreen stops warning about an unknown publisher. Applied on 2026-10-26; waiting for their answer. Once approved: store the SignPath token as a secret and sign the installer from the release workflow through Tauri's `signCommand`, so the updater's `.sig` is made from the signed file
- [ ] **winget package** (`Textic.DynoMusic`): first submission by hand with `wingetcreate new <setup.exe URL>`, then a `winget-releaser` job in the release workflow for later versions (needs a fork of `microsoft/winget-pkgs` and a `WINGET_TOKEN` secret)

## Testing

- [ ] **Try the keyboard shortcuts** by hand, especially a global one used from another app
- [ ] **Try the new appearance and playback settings**: light and system themes (main window and mini player), the artwork accent, reduced motion, and audio quality (whether YouTube Music really switches from the next song)
- [ ] **Try ad skipping** (Settings → Playback) with an account without Premium: ads should be silent and gone within a second
