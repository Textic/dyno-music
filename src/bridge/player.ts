import type { PlayerCommand } from "../shared/types";
import { log } from "./ipc";
import { clickPlayerBar, videoElement, waitFor, ytmApp, ytPlayer } from "./ytm";

/** Called by the state watcher after a command so the UI updates without waiting for the next poll. */
let onChange: () => void = () => {};
export function setOnChange(callback: () => void): void {
  onChange = callback;
}

export async function runCommand(cmd: PlayerCommand): Promise<void> {
  const player = ytPlayer();
  const video = videoElement();
  switch (cmd.type) {
    case "play":
      player ? player.playVideo() : void video?.play();
      break;
    case "pause":
      player ? player.pauseVideo() : video?.pause();
      break;
    case "toggle": {
      const playing = player ? player.getPlayerState() === 1 : video ? !video.paused : false;
      return runCommand({ type: playing ? "pause" : "play" });
    }
    case "next":
      if (!clickPlayerBar(".next-button")) log("warn", "Next button not found");
      break;
    case "previous":
      if (!clickPlayerBar(".previous-button")) log("warn", "Previous button not found");
      break;
    case "seek":
      if (player) player.seekTo(cmd.positionSec, true);
      else if (video) video.currentTime = cmd.positionSec;
      break;
    case "volume":
      if (player) player.setVolume(cmd.value);
      else if (video) video.volume = cmd.value / 100;
      break;
    case "playVideo":
      await playVideo(cmd.videoId, cmd.playlistId ?? undefined);
      break;
  }
  onChange();
}

function isCurrent(videoId: string): boolean {
  return ytPlayer()?.getVideoData()?.video_id === videoId;
}

/**
 * Phase 0 tries, in order:
 * 1. Internal SPA navigation (keeps YouTube Music's queue and radio, no reload).
 * 2. Loading the video straight into the player (no reload, but bypasses the queue).
 * 3. Full navigation to /watch (reloads the page; relies on autoplay).
 */
async function playVideo(videoId: string, playlistId?: string): Promise<void> {
  const watchEndpoint = playlistId ? { videoId, playlistId } : { videoId };
  ytmApp()?.dispatchEvent(
    new CustomEvent("yt-navigate", {
      bubbles: true,
      composed: true,
      detail: { endpoint: { watchEndpoint } },
    }),
  );
  if (await waitFor(() => isCurrent(videoId), 4000)) {
    return reportMethod("SPA navigation (yt-navigate)");
  }

  const player = ytPlayer();
  if (player?.loadVideoById) {
    player.loadVideoById(videoId);
    if (await waitFor(() => isCurrent(videoId), 4000)) {
      return reportMethod("loadVideoById (outside the queue)");
    }
  }

  reportMethod("/watch reload");
  const params = new URLSearchParams({ v: videoId });
  if (playlistId) params.set("list", playlistId);
  location.assign(`/watch?${params}`);
}

function reportMethod(method: string): void {
  log(method.startsWith("SPA") ? "info" : "warn", `Playback started with: ${method}`);
}
