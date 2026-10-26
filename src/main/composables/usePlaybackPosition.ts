import { onScopeDispose, ref, watch } from "vue";
import { usePlayerStore } from "@/main/stores/player";

/**
 * Current position in seconds, interpolated between the bridge's ~1 s updates.
 * Animates only while playing, so an idle app does not redraw every frame.
 */
export function usePlaybackPosition() {
  const player = usePlayerStore();
  const position = ref(player.state.positionSec);
  let frame = 0;

  function compute(): number {
    const { positionSec, status, track } = player.state;
    if (status !== "playing") return positionSec;
    const elapsed = (performance.now() - player.stateReceivedAt) / 1000;
    return Math.min(positionSec + elapsed, track?.durationSec || Infinity);
  }

  function tick(): void {
    position.value = compute();
    frame = requestAnimationFrame(tick);
  }

  watch(
    () => [player.state, player.stateReceivedAt] as const,
    () => {
      cancelAnimationFrame(frame);
      position.value = compute();
      if (player.state.status === "playing") frame = requestAnimationFrame(tick);
    },
    { immediate: true },
  );

  onScopeDispose(() => cancelAnimationFrame(frame));
  return position;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
