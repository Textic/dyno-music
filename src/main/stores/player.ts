import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { SHUFFLE_PARAMS } from "@/main/services/music";
import * as api from "@/shared/api";
import type { MediaItem, QueueEntry } from "@/shared/innertube/model";
import {
  IDLE_STATE,
  type LikeStatus,
  type LogEntry,
  type PlayerCommand,
  type PlayerState,
  type SessionInfo,
} from "@/shared/types";

/** Mirror of the hidden player, kept up to date from Rust's player://* events. */
export const usePlayerStore = defineStore("player", () => {
  const state = ref<PlayerState>(IDLE_STATE);
  /** performance.now() when `state` arrived, to interpolate the position in between updates. */
  const stateReceivedAt = ref(performance.now());
  const session = ref<SessionInfo | null>(null);
  const signingIn = ref(false);
  const queue = ref<QueueEntry[]>([]);

  const track = computed(() => state.value.track);
  const isPlaying = computed(() => state.value.status === "playing" || state.value.status === "buffering");
  const artistNames = computed(() => track.value?.artists.map((a) => a.name).join(", ") ?? "");
  const signedIn = computed(() => session.value?.loggedIn === true);

  function setState(next: PlayerState): void {
    state.value = next;
    stateReceivedAt.value = performance.now();
  }

  /** Bridge and UI messages; visible in the devtools console. */
  function log({ level, message }: LogEntry): void {
    console[level](`[dyno] ${message}`);
  }

  /** Sends a command, logging failures instead of throwing at the caller. */
  async function command(cmd: PlayerCommand): Promise<void> {
    try {
      await api.playerCmd(cmd);
    } catch (err) {
      log({ level: "error", message: String(err) });
    }
  }

  let started = false;
  async function start(): Promise<void> {
    if (started) return;
    started = true;
    await Promise.all([
      api.onSession((next) => (session.value = next)),
      api.onState(setState),
      api.onQueue((next) => (queue.value = next)),
      api.onLog(log),
    ]);
    const snapshot = await api.getSnapshot();
    session.value = snapshot.session;
    setState(snapshot.state);
    queue.value = snapshot.queue ?? [];
  }

  async function signIn(): Promise<void> {
    signingIn.value = true;
    try {
      await api.signIn();
      log({ level: "info", message: "Signed in" });
    } catch (err) {
      log({ level: "warn", message: `Sign-in: ${err}` });
    } finally {
      signingIn.value = false;
    }
  }

  /**
   * Plays an item. `context` is the album or playlist it was picked from, so playback carries on
   * through the rest of that list.
   */
  function play(item: MediaItem, context?: string): Promise<void> {
    if (item.videoId) return command({ type: "watch", videoId: item.videoId, playlistId: context ?? item.playlistId });
    if (item.playlistId) return command({ type: "watch", playlistId: item.playlistId });
    return Promise.resolve();
  }

  function playList(playlistId: string, options: { shuffle?: boolean } = {}): Promise<void> {
    return command({ type: "watch", playlistId, params: options.shuffle ? SHUFFLE_PARAMS : null });
  }

  function addToQueue(item: MediaItem, next: boolean): Promise<void> {
    return command({ type: "queueAdd", videoId: item.videoId, playlistId: item.videoId ? null : item.playlistId, next });
  }

  return {
    state,
    stateReceivedAt,
    session,
    signingIn,
    queue,
    track,
    isPlaying,
    artistNames,
    signedIn,
    start,
    signIn,
    log,
    play,
    playList,
    addToQueue,
    toggle: () => command({ type: "toggle" }),
    next: () => command({ type: "next" }),
    previous: () => command({ type: "previous" }),
    seek: (positionSec: number) => command({ type: "seek", positionSec }),
    setVolume: (value: number) => command({ type: "volume", value }),
    cycleRepeat: () => command({ type: "repeat" }),
    shuffle: () => command({ type: "shuffle" }),
    like: (status: LikeStatus) => command({ type: "like", status }),
    queuePlay: (index: number) => command({ type: "queuePlay", index }),
    queueMove: (from: number, to: number) => command({ type: "queueMove", from, to }),
    queueRemove: (index: number) => command({ type: "queueRemove", index }),
  };
});
