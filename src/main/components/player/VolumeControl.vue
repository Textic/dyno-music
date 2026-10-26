<script setup lang="ts">
import { Volume2, VolumeX } from "lucide-vue-next";
import { computed, ref } from "vue";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();

/**
 * The player UI redraws every frame while playing, and each redraw would put the slider back
 * to the last reported volume, fighting the drag: keep the dragged value until it is released.
 */
const dragging = ref<number | null>(null);
const shown = computed(() => dragging.value ?? Math.round(player.state.volume));
const SEND_EVERY_MS = 80;
let lastSent = 0;

function onInput(event: Event): void {
  dragging.value = Number((event.target as HTMLInputElement).value);
  // Apply it while dragging too, without flooding the player.
  const now = performance.now();
  if (now - lastSent >= SEND_EVERY_MS) {
    lastSent = now;
    void player.setVolume(dragging.value);
  }
}

function onChange(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  void player.setVolume(value).finally(() => (dragging.value = null));
}
</script>

<template>
  <div class="flex items-center gap-2 text-ink-soft">
    <VolumeX v-if="player.state.muted || shown === 0" class="size-[18px] shrink-0" />
    <Volume2 v-else class="size-[18px] shrink-0" />
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      :value="shown"
      aria-label="Volume"
      class="w-24"
      @input="onInput"
      @change="onChange"
    />
  </div>
</template>
