import type { PlayerCommand } from "../shared/types";
import { innertube } from "./innertube";
import { log } from "./ipc";
import { clickPlayerBar, pageStore, playerBar, queueElement, videoElement, waitFor, ytmApp, ytPlayer } from "./ytm";

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
      setVolume(cmd.value);
      saveVolume(cmd.value);
      break;
    case "watch":
      await watch(cmd.videoId ?? undefined, cmd.playlistId ?? undefined, cmd.params ?? undefined);
      break;
    case "repeat":
      playerBar()?.onRepeatButtonClick?.();
      break;
    case "shuffle":
      playerBar()?.queue?.shuffle?.();
      break;
    case "like":
      likeCurrent(cmd.status);
      break;
    case "queuePlay":
      queueElement()?.dispatch({ type: "SET_INDEX", payload: cmd.index });
      break;
    case "queueMove":
      queueElement()?.dispatch({ type: "MOVE_ITEM", payload: { fromIndex: cmd.from, toIndex: cmd.to } });
      break;
    case "queueRemove":
      queueElement()?.dispatch({ type: "REMOVE_ITEM", payload: cmd.index });
      break;
    case "queueAdd":
      await addToQueue(cmd.videoId ?? undefined, cmd.playlistId ?? undefined, cmd.next);
      break;
  }
  onChange();
}

const VOLUME_KEY = "dyno.volume";

function setVolume(value: number): void {
  const bar = playerBar();
  if (bar?.updateVolume) bar.updateVolume(value);
  const player = ytPlayer();
  if (player) player.setVolume(value);
  else {
    const video = videoElement();
    if (video) video.volume = value / 100;
  }
}

function saveVolume(value: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(value));
  } catch {
    // Storage unavailable: the volume just won't survive a restart.
  }
}

/** YouTube Music starts at full volume; put back the one the user last chose in the app. */
export async function restoreVolume(): Promise<void> {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(VOLUME_KEY);
  } catch {
    return;
  }
  const saved = Number(stored);
  if (stored === null || !Number.isFinite(saved)) return;
  if (!(await waitFor(() => ytPlayer() !== null, 30_000, 250))) return;
  setVolume(saved);
  onChange();
}

function currentVideoId(): string | undefined {
  return ytPlayer()?.getVideoData()?.video_id || undefined;
}

/**
 * Starts playback the way YouTube Music's own links do (SPA navigation), so its queue, radio
 * and autoplay keep working. Falls back to loading the video directly, then to a full reload.
 */
async function watch(videoId?: string, playlistId?: string, params?: string): Promise<void> {
  const before = currentVideoId();
  const target = Object.fromEntries(Object.entries({ videoId, playlistId, params }).filter(([, v]) => v));
  const endpoint = videoId ? { watchEndpoint: target } : { watchPlaylistEndpoint: target };
  ytmApp()?.dispatchEvent(new CustomEvent("yt-navigate", { bubbles: true, composed: true, detail: { endpoint } }));

  const started = () => {
    const now = currentVideoId();
    return videoId ? now === videoId : Boolean(now) && now !== before;
  };
  if (await waitFor(started, 5000)) return;

  const player = ytPlayer();
  if (videoId && player?.loadVideoById) {
    log("warn", "SPA navigation did not start playback; loading the video directly");
    player.loadVideoById(videoId);
    if (await waitFor(started, 4000)) return;
  }

  log("warn", "Falling back to reloading /watch");
  const query = new URLSearchParams();
  if (videoId) query.set("v", videoId);
  if (playlistId) query.set("list", playlistId);
  location.assign(`/watch?${query}`);
}

/** Uses the player bar's like button, which also tells YouTube Music. */
function likeCurrent(status: "LIKE" | "DISLIKE" | "INDIFFERENT"): void {
  const button = document.querySelector("#like-button-renderer") as
    | (HTMLElement & { updateLikeStatus?(status: string): void })
    | null;
  if (button?.updateLikeStatus) button.updateLikeStatus(status);
  else log("warn", "Like button not found");
}

/**
 * Asks YouTube Music for the queue entries of a track or list and inserts them the same way its
 * own "Play next" / "Add to queue" menu items do.
 */
async function addToQueue(videoId: string | undefined, playlistId: string | undefined, next: boolean): Promise<void> {
  const queue = queueElement();
  const state = pageStore()?.getState().queue;
  if (!queue || !state?.items?.length) {
    // Nothing is playing yet: just play it.
    return watch(videoId, playlistId);
  }

  const response = (await innertube("music/get_queue", {
    queueContextParams: state.queueContextParams,
    queueInsertPosition: next ? "INSERT_AFTER_CURRENT_VIDEO" : "INSERT_AT_END",
    ...(videoId ? { videoIds: [videoId] } : { playlistId }),
  })) as { queueDatas?: { content?: unknown }[] };

  const items = (response.queueDatas ?? []).map((d) => d.content).filter(Boolean);
  if (!items.length) return log("warn", "YouTube Music returned nothing to add to the queue");

  const length = state.items.length;
  const current = state.selectedItemIndex ?? -1;
  queue.dispatch({
    type: "ADD_ITEMS",
    payload: {
      nextQueueItemId: state.nextQueueItemId,
      index: next && current >= 0 ? current + 1 : length,
      items,
      shuffleEnabled: false,
      shouldAssignIds: true,
    },
  });
}
