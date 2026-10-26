// Keeps the hidden page playing: nobody can see or answer YouTube Music's prompts there.

import { log } from "./ipc";
import { ytPlayer } from "./ytm";

declare global {
  interface Window {
    /** Time of the user's last interaction, which YouTube uses to decide they are away. */
    _lact?: number;
  }
}

const ACTIVITY_EVERY_MS = 60_000;
const PROMPT_CHECK_EVERY_MS = 5_000;

function dismissStillListening(): void {
  const prompt = document.querySelector<HTMLElement>("ytmusic-you-there-renderer");
  if (!prompt || prompt.closest("[aria-hidden='true']") || !prompt.isConnected) return;
  const button = prompt.querySelector<HTMLElement>("button, yt-button-renderer, tp-yt-paper-button");
  if (!button) return;
  button.click();
  const player = ytPlayer();
  if (player && player.getPlayerState() === 2) player.playVideo();
  log("info", 'Answered the "still listening?" prompt');
}

export function startHousekeeping(): void {
  // Listening for hours without touching the page is exactly what this app is for.
  setInterval(() => {
    window._lact = Date.now();
  }, ACTIVITY_EVERY_MS);
  // In case the prompt shows up anyway, answer it and resume.
  setInterval(dismissStillListening, PROMPT_CHECK_EVERY_MS);
}
