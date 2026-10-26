import { defineConfig } from "vite";

// Builds the script injected into music.youtube.com as a single self-contained IIFE.
// src-tauri/src/player.rs embeds the output with include_str!.
export default defineConfig({
  build: {
    outDir: "dist-bridge",
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: "src/bridge/index.ts",
      formats: ["iife"],
      name: "DynoBridge",
      fileName: () => "bridge.js",
    },
  },
});
