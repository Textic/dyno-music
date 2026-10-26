<script setup lang="ts">
import { computed, ref } from "vue";
import { formatTime, usePlaybackPosition } from "@/main/composables/usePlaybackPosition";
import { usePlayerStore } from "@/main/stores/player";

withDefaults(defineProps<{ large?: boolean }>(), { large: false });

const player = usePlayerStore();
const position = usePlaybackPosition();

const duration = computed(() => player.track?.durationSec ?? 0);
/** While the user drags, show their value instead of the live position. */
const dragging = ref<number | null>(null);
const shown = computed(() => dragging.value ?? position.value);
const progress = computed(() => (duration.value ? (shown.value / duration.value) * 100 : 0));

function onInput(event: Event): void {
  dragging.value = Number((event.target as HTMLInputElement).value);
}

function onChange(event: Event): void {
  dragging.value = null;
  void player.seek(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="flex w-full items-center gap-2.5 text-ink-faint tabular-nums" :class="large ? 'text-xs' : 'text-[11px]'">
    <span class="w-10 text-right">{{ formatTime(shown) }}</span>
    <div class="group relative flex-1 rounded-full bg-white/10" :class="large ? 'h-1.5' : 'h-1'">
      <div
        class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-soft"
        :style="{ width: `${progress}%` }"
      />
      <div
        class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink opacity-0 shadow transition group-hover:opacity-100"
        :style="{ left: `${progress}%` }"
      />
      <input
        type="range"
        min="0"
        :max="Math.floor(duration)"
        step="1"
        :value="Math.floor(shown)"
        :disabled="!duration"
        aria-label="Position"
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        @input="onInput"
        @change="onChange"
      />
    </div>
    <span class="w-10">{{ formatTime(duration) }}</span>
  </div>
</template>
