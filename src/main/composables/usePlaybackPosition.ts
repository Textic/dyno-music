import { onScopeDispose, ref, watch } from "vue";
import { usePlayerStore } from "@/main/stores/player";

/**
 * How often the interpolated position moves while playing. A progress bar of a few hundred pixels
 * moves about a pixel per second, so redrawing it on every frame (60–144 times a second) kept the
 * interface and the GPU busy for nothing; lyrics only need to change line on time.
 */
const TICK_MS = 250;

/**
 * Current position in seconds, interpolated between the bridge's ~1 s updates. Ticks only while
 * playing and while the window can be seen, so an idle or hidden app does no work.
 */
export function usePlaybackPosition() {
  const player = usePlayerStore();
  const position = ref(player.state.positionSec);
  let timer = 0;

  function compute(): number {
    const { positionSec, status, track } = player.state;
    if (status !== "playing") return positionSec;
    const elapsed = (performance.now() - player.stateReceivedAt) / 1000;
    return Math.min(positionSec + elapsed, track?.durationSec || Infinity);
  }

  function restart(): void {
    clearInterval(timer);
    timer = 0;
    position.value = compute();
    if (player.state.status === "playing" && document.visibilityState === "visible") {
      timer = window.setInterval(() => (position.value = compute()), TICK_MS);
    }
  }

  watch(() => [player.state, player.stateReceivedAt] as const, restart, { immediate: true });
  document.addEventListener("visibilitychange", restart);

  onScopeDispose(() => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", restart);
  });
  return position;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
