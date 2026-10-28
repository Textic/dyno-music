<script setup lang="ts">
import { Volume2, VolumeX } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();

/**
 * The player UI redraws every frame while playing, and each redraw would put the slider back
 * to the last reported volume, fighting the drag: keep the user's value until they are done.
 */
const pending = ref<number | null>(null);
const shown = computed(() => pending.value ?? Math.round(player.state.volume));

const SEND_EVERY_MS = 80;
/** If YouTube Music never reports the new volume, stop waiting for it after this long. */
const CONFIRM_TIMEOUT_MS = 1500;
/** The wheel has no "release": treat this much quiet as the end of the gesture. */
const WHEEL_SETTLE_MS = 400;
/** How long the percentage stays up after the last change. */
const BUBBLE_FOR_MS = 1000;

let lastSent = 0;
let settleTimer = 0;
let confirmTimer = 0;
let bubbleTimer = 0;
const bubble = ref(false);
const pressed = ref(false);

function showBubble(): void {
  bubble.value = true;
  clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => {
    if (!pressed.value) bubble.value = false;
  }, BUBBLE_FOR_MS);
}

/** Applies the value while the gesture goes on, without flooding the player. */
function preview(value: number): void {
  // A new gesture: the last one's wait for confirmation no longer applies.
  clearTimeout(confirmTimer);
  pending.value = value;
  showBubble();
  const now = performance.now();
  if (now - lastSent >= SEND_EVERY_MS) {
    lastSent = now;
    void player.setVolume(value);
  }
}


/**
 * Sends the final value and keeps showing it until the player reports it back. Letting go as soon
 * as the command was sent showed the previous report for a frame (scrolling down to 6% flashed 11%).
 */
function commit(value: number): void {
  // The gesture is over (the wheel's settle timer may be what called this).
  clearTimeout(settleTimer);
  settleTimer = 0;
  pending.value = value;
  void player.setVolume(value);
  clearTimeout(confirmTimer);
  confirmTimer = window.setTimeout(() => (pending.value = null), CONFIRM_TIMEOUT_MS);
}

watch(
  () => Math.round(player.state.volume),
  (reported) => {
    if (pending.value !== null && !pressed.value && reported === pending.value && !settleTimer) {
      clearTimeout(confirmTimer);
      pending.value = null;
    }
  },
);

function onInput(event: Event): void {
  preview(Number((event.target as HTMLInputElement).value));
}

function onChange(event: Event): void {
  commit(Number((event.target as HTMLInputElement).value));
}

/** One notch of the wheel is one percent. */
function onWheel(event: WheelEvent): void {
  if (event.deltaY === 0) return;
  const value = Math.min(100, Math.max(0, shown.value + (event.deltaY < 0 ? 1 : -1)));
  preview(value);
  clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => commit(value), WHEEL_SETTLE_MS);
}

function onPointerDown(): void {
  pressed.value = true;
  showBubble();
}

function onPointerUp(): void {
  pressed.value = false;
  showBubble();
}

onBeforeUnmount(() => {
  clearTimeout(settleTimer);
  clearTimeout(confirmTimer);
  clearTimeout(bubbleTimer);
});
</script>

<template>
  <div class="flex items-center gap-2 text-ink-soft" @wheel.prevent="onWheel">
    <!-- Changing the volume while muted unmutes, as in YouTube Music. -->
    <button
      class="grid size-7 shrink-0 place-items-center rounded-full transition hover:bg-white/10 hover:text-ink"
      :aria-label="player.state.muted ? 'Unmute' : 'Mute'"
      :title="player.state.muted ? 'Unmute' : 'Mute'"
      :aria-pressed="player.state.muted"
      @click="player.setMuted(!player.state.muted)"
    >
      <VolumeX v-if="player.state.muted || shown === 0" class="size-[18px]" />
      <Volume2 v-else class="size-[18px]" />
    </button>
    <div class="relative flex items-center">
      <Transition
        enter-active-class="transition duration-150"
        leave-active-class="transition duration-200"
        enter-from-class="translate-y-1 opacity-0"
        leave-to-class="translate-y-1 opacity-0"
      >
        <span
          v-if="bubble"
          class="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-lg bg-ink px-2 py-0.5 text-xs font-semibold text-night tabular-nums shadow-lg shadow-shade/40"
          :style="{ left: `calc(${shown}% + ${(50 - shown) * 0.12}px)` }"
          aria-hidden="true"
        >
          {{ shown }}%
        </span>
      </Transition>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="shown"
        aria-label="Volume"
        :aria-valuetext="`${shown}%`"
        class="w-24 transition-opacity"
        :class="player.state.muted && 'opacity-50'"
        @input="onInput"
        @change="onChange"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
      />
    </div>
  </div>
</template>
