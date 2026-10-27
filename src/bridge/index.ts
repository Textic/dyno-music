// Injected into music.youtube.com (hidden "player" window) as an initialization script.
// Rust drives it through window.__dynoBridge; it reports back with the bridge_* commands.

import type { AudioQuality, BridgeRequest, PlayerCommand } from "../shared/types";
import { setSkipAds, startAdSkipper } from "./ads";
import { handleRequest } from "./innertube";
import { log, send } from "./ipc";
import { restoreVolume, runCommand } from "./player";
import { setAudioQuality } from "./quality";
import { startHousekeeping } from "./housekeeping";
import { startQueueWatcher, startStateWatcher } from "./state";
import { preferEnglish, waitFor, ytcfg, ytmApp } from "./ytm";

interface PageSettings {
  skipAds: boolean;
  audioQuality: AudioQuality;
}

interface DynoBridge {
  command(cmd: PlayerCommand): void;
  request(req: BridgeRequest): void;
  /** The settings this page acts on itself; Rust sends them on load and on every change. */
  applySettings(settings: PageSettings): void;
}

declare global {
  interface Window {
    __dynoBridge?: DynoBridge;
  }
}

async function boot(): Promise<void> {
  // ytcfg and <ytmusic-app> exist once YouTube Music's own scripts have run.
  await waitFor(() => window.ytcfg !== undefined && ytmApp() !== null, 60_000, 250);
  preferEnglish();
  await send("bridge_ready", {
    session: { loggedIn: ytcfg("LOGGED_IN") === true, url: location.href },
  });
  startStateWatcher();
  startQueueWatcher();
  startHousekeeping();
  startAdSkipper();
  void restoreVolume();
}

// The script also runs on Google's sign-in pages while the user logs in: stay out of those.
if (window.top === window && location.hostname === "music.youtube.com" && !window.__dynoBridge) {
  window.__dynoBridge = {
    command: (cmd) => {
      runCommand(cmd).catch((err) => log("error", `Command ${cmd.type} failed: ${err}`));
    },
    request: (req) => void handleRequest(req),
    applySettings: (settings) => {
      setSkipAds(settings.skipAds);
      setAudioQuality(settings.audioQuality);
    },
  };
  void boot();
}
