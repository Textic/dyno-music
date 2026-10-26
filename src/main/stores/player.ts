import { defineStore } from "pinia";
import { computed, ref } from "vue";
import * as api from "@/shared/api";
import { IDLE_STATE, type LogEntry, type PlayerState, type SessionInfo } from "@/shared/types";

/** Mirror of the hidden player, kept up to date from Rust's player://* events. */
export const usePlayerStore = defineStore("player", () => {
  const state = ref<PlayerState>(IDLE_STATE);
  /** performance.now() when `state` arrived, to interpolate the position in between updates. */
  const stateReceivedAt = ref(performance.now());
  const session = ref<SessionInfo | null>(null);
  const signingIn = ref(false);

  const track = computed(() => state.value.track);
  const isPlaying = computed(() => state.value.status === "playing" || state.value.status === "buffering");
  const artistNames = computed(() => track.value?.artists.map((a) => a.name).join(", ") ?? "");

  function setState(next: PlayerState): void {
    state.value = next;
    stateReceivedAt.value = performance.now();
  }

  /** Bridge and UI messages; visible in the devtools console. */
  function log({ level, message }: LogEntry): void {
    console[level](`[dyno] ${message}`);
  }

  /** Runs a command, logging failures instead of throwing at the caller. */
  async function run(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
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
      api.onLog(log),
    ]);
    const snapshot = await api.getSnapshot();
    session.value = snapshot.session;
    setState(snapshot.state);
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

  return {
    state,
    stateReceivedAt,
    session,
    signingIn,
    track,
    isPlaying,
    artistNames,
    start,
    signIn,
    log,
    toggle: () => run(() => api.playerCmd({ type: "toggle" })),
    next: () => run(() => api.playerCmd({ type: "next" })),
    previous: () => run(() => api.playerCmd({ type: "previous" })),
    seek: (positionSec: number) => run(() => api.playerCmd({ type: "seek", positionSec })),
    setVolume: (value: number) => run(() => api.playerCmd({ type: "volume", value })),
    playVideo: (videoId: string) => run(() => api.playerCmd({ type: "playVideo", videoId })),
  };
});
