<script setup lang="ts">
import {
  ListMusic,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-vue-next";
import { computed, ref } from "vue";
import { formatTime, usePlaybackPosition } from "@/main/composables/usePlaybackPosition";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";

const player = usePlayerStore();
const ui = useUiStore();
const position = usePlaybackPosition();

const duration = computed(() => player.track?.durationSec ?? 0);
/** While the user drags the seek bar, show their value instead of the live position. */
const dragging = ref<number | null>(null);
const shownPosition = computed(() => dragging.value ?? position.value);
const progress = computed(() => (duration.value ? (shownPosition.value / duration.value) * 100 : 0));

const liked = computed(() => player.state.likeStatus === "LIKE");
const disliked = computed(() => player.state.likeStatus === "DISLIKE");
const repeatLabel = computed(
  () => ({ NONE: "Repeat: off", ALL: "Repeat: all", ONE: "Repeat: one" })[player.state.repeat],
);

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

const iconButton =
  "grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink disabled:opacity-40";
</script>

<template>
  <!-- The only element with backdrop blur: it floats over scrolling content. -->
  <div
    class="absolute inset-x-6 bottom-5 z-30 mx-auto flex max-w-5xl items-center gap-5 rounded-3xl border border-white/10 bg-black/40 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-2xl"
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
      <div v-if="player.track && player.signedIn" class="hidden shrink-0 items-center xl:flex">
        <button
          :class="iconButton"
          :aria-label="disliked ? 'Remove dislike' : 'Dislike'"
          :aria-pressed="disliked"
          @click="player.like(disliked ? 'INDIFFERENT' : 'DISLIKE')"
        >
          <ThumbsDown class="size-4" :fill="disliked ? 'currentColor' : 'none'" />
        </button>
        <button
          :class="[iconButton, liked && '!text-accent-soft']"
          :aria-label="liked ? 'Remove like' : 'Like'"
          :aria-pressed="liked"
          @click="player.like(liked ? 'INDIFFERENT' : 'LIKE')"
        >
          <ThumbsUp class="size-4" :fill="liked ? 'currentColor' : 'none'" />
        </button>
      </div>
    </div>

    <div class="flex w-[clamp(220px,36vw,440px)] shrink-0 flex-col items-center gap-1.5">
      <div class="flex items-center gap-2">
        <button
          :class="[iconButton, player.state.shuffle && '!text-accent-soft']"
          aria-label="Shuffle"
          :aria-pressed="player.state.shuffle"
          :disabled="!player.track"
          @click="player.shuffle()"
        >
          <Shuffle class="size-4" />
        </button>
        <button :class="iconButton" aria-label="Previous" @click="player.previous()">
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
        <button :class="iconButton" aria-label="Next" @click="player.next()">
          <SkipForward class="size-[18px]" fill="currentColor" />
        </button>
        <button
          :class="[iconButton, player.state.repeat !== 'NONE' && '!text-accent-soft']"
          :aria-label="repeatLabel"
          :title="repeatLabel"
          :disabled="!player.track"
          @click="player.cycleRepeat()"
        >
          <Repeat1 v-if="player.state.repeat === 'ONE'" class="size-4" />
          <Repeat v-else class="size-4" />
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

    <div class="flex flex-1 items-center justify-end gap-2 text-ink-soft">
      <button
        :class="[iconButton, ui.queueOpen && '!bg-white/10 !text-ink']"
        aria-label="Queue"
        :aria-pressed="ui.queueOpen"
        @click="ui.queueOpen = !ui.queueOpen"
      >
        <ListMusic class="size-[18px]" />
      </button>
      <div class="hidden items-center gap-2 lg:flex">
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
  </div>
</template>
