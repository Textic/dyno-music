<script setup lang="ts">
import { Music, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-vue-next";
import { computed, ref } from "vue";
import { formatTime, usePlaybackPosition } from "@/main/composables/usePlaybackPosition";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();
const position = usePlaybackPosition();

const duration = computed(() => player.track?.durationSec ?? 0);
/** While the user drags the seek bar, show their value instead of the live position. */
const dragging = ref<number | null>(null);
const shownPosition = computed(() => dragging.value ?? position.value);
const progress = computed(() => (duration.value ? (shownPosition.value / duration.value) * 100 : 0));

function onSeekInput(event: Event): void {
  dragging.value = Number((event.target as HTMLInputElement).value);
}

function onSeekChange(event: Event): void {
  dragging.value = null;
  void player.seek(Number((event.target as HTMLInputElement).value));
}

function onVolumeChange(event: Event): void {
  void player.setVolume(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <!-- The only element with backdrop blur: it floats over scrolling content. -->
  <div
    class="absolute inset-x-6 bottom-5 mx-auto flex max-w-4xl items-center gap-5 rounded-3xl border border-white/10 bg-black/40 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-2xl"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <div class="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white/5">
        <img v-if="player.track?.thumbnail" :src="player.track.thumbnail" alt="" class="size-full object-cover" />
        <Music v-else class="absolute inset-0 m-auto size-6 text-ink-faint" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold">
          {{ player.state.isAd ? "Ad" : (player.track?.title ?? "Nothing playing") }}
        </p>
        <p class="truncate text-xs text-ink-soft">{{ player.artistNames || "Search for something to play" }}</p>
      </div>
    </div>

    <div class="flex w-[clamp(200px,34vw,420px)] shrink-0 flex-col items-center gap-1.5">
      <div class="flex items-center gap-3">
        <button
          class="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink"
          aria-label="Previous"
          @click="player.previous()"
        >
          <SkipBack class="size-[18px]" fill="currentColor" />
        </button>
        <button
          class="grid size-11 place-items-center rounded-full bg-ink text-night shadow-lg transition hover:scale-105 active:scale-95"
          :aria-label="player.isPlaying ? 'Pause' : 'Play'"
          @click="player.toggle()"
        >
          <Pause v-if="player.isPlaying" class="size-5" fill="currentColor" />
          <Play v-else class="size-5 translate-x-px" fill="currentColor" />
        </button>
        <button
          class="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink"
          aria-label="Next"
          @click="player.next()"
        >
          <SkipForward class="size-[18px]" fill="currentColor" />
        </button>
      </div>

      <div class="flex w-full items-center gap-2.5 text-[11px] text-ink-faint tabular-nums">
        <span class="w-9 text-right">{{ formatTime(shownPosition) }}</span>
        <div class="group relative h-1 flex-1 rounded-full bg-white/10">
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-soft"
            :style="{ width: `${progress}%` }"
          />
          <input
            type="range"
            min="0"
            :max="Math.floor(duration)"
            step="1"
            :value="Math.floor(shownPosition)"
            :disabled="!duration"
            aria-label="Position"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            @input="onSeekInput"
            @change="onSeekChange"
          />
        </div>
        <span class="w-9">{{ formatTime(duration) }}</span>
      </div>
    </div>

    <div class="hidden flex-1 items-center justify-end gap-2 text-ink-soft lg:flex">
      <VolumeX v-if="player.state.muted || player.state.volume === 0" class="size-[18px]" />
      <Volume2 v-else class="size-[18px]" />
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="Math.round(player.state.volume)"
        aria-label="Volume"
        class="w-24"
        @change="onVolumeChange"
      />
    </div>
  </div>
</template>
