<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Pause, Pin, PinOff, Play, SkipBack, SkipForward, ThumbsUp } from "lucide-vue-next";
import { computed, ref } from "vue";
import CoverImage from "@/main/components/CoverImage.vue";
import { useAppearance } from "@/main/composables/useAppearance";
import { formatTime, usePlaybackPosition } from "@/main/composables/usePlaybackPosition";
import { useShortcuts } from "@/main/composables/useShortcuts";
import { usePlayerStore } from "@/main/stores/player";
import * as api from "@/shared/api";

const player = usePlayerStore();
const position = usePlaybackPosition();
useShortcuts();
useAppearance();
// Null in a plain browser (previewing the UI without Tauri).
const appWindow = isTauri() ? getCurrentWindow() : null;

/** Starts on top of other windows; the pin turns that off for this session. */
const pinned = ref(true);
async function togglePin(): Promise<void> {
  const next = !pinned.value;
  try {
    await appWindow?.setAlwaysOnTop(next);
    pinned.value = next;
  } catch (err) {
    player.log({ level: "error", message: `Mini player pin: ${err}` });
  }
}

function backToMain(): void {
  api.closeMiniPlayer().catch((err) => player.log({ level: "error", message: String(err) }));
}

const duration = computed(() => player.track?.durationSec ?? 0);
/** While the user drags, show their value instead of the live position. */
const dragging = ref<number | null>(null);
const shown = computed(() => dragging.value ?? position.value);
const progress = computed(() => (duration.value ? Math.min(100, (shown.value / duration.value) * 100) : 0));
const liked = computed(() => player.state.likeStatus === "LIKE");

function onSeekInput(event: Event): void {
  dragging.value = Number((event.target as HTMLInputElement).value);
}

function onSeekChange(event: Event): void {
  dragging.value = null;
  void player.seek(Number((event.target as HTMLInputElement).value));
}

const button =
  "grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink disabled:opacity-40";
const corner =
  "grid size-7 place-items-center rounded-full bg-black/30 text-ink-soft transition hover:bg-black/50 hover:text-ink";
</script>

<template>
  <!-- The whole window drags; data-tauri-drag-region only applies to the element that carries
       it, so text and artwork let clicks through to it. -->
  <div class="group relative isolate flex h-full items-center gap-3 overflow-hidden px-3 pt-3 pb-4" data-tauri-drag-region>
    <div class="pointer-events-none absolute inset-0 -z-10 bg-night" aria-hidden="true">
      <!-- New artwork fades in over the old one, which stays until covered (see AmbientBackground). -->
      <div class="absolute inset-0 opacity-60">
        <Transition
          enter-active-class="z-[1] transition-opacity duration-700"
          leave-active-class="transition-opacity duration-700"
          enter-from-class="opacity-0"
          :leave-to-class="player.track?.thumbnail ? '' : 'opacity-0'"
        >
          <img
            v-if="player.track?.thumbnail"
            :key="player.track.thumbnail"
            :src="player.track.thumbnail"
            alt=""
            class="absolute inset-0 size-full scale-150 object-cover blur-2xl saturate-150"
          />
        </Transition>
      </div>
      <div class="absolute inset-0 bg-gradient-to-r from-black/55 to-black/30" />
    </div>

    <div class="pointer-events-none size-[84px] shrink-0 overflow-hidden rounded-xl bg-white/5 shadow-lg shadow-shade/40">
      <CoverImage :src="player.track?.thumbnail" />
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-1.5" data-tauri-drag-region>
      <div class="pointer-events-none min-w-0 pr-16">
        <p class="truncate text-sm font-semibold">
          {{ player.state.isAd ? "Ad" : (player.track?.title ?? "Nothing playing") }}
        </p>
        <p class="truncate text-xs text-ink-soft">{{ player.artistNames || "Dyno Music" }}</p>
      </div>

      <div class="flex items-center gap-1" data-tauri-drag-region>
        <button :class="button" aria-label="Previous" :disabled="!player.track" @click="player.previous()">
          <SkipBack class="size-4" fill="currentColor" />
        </button>
        <button
          class="grid size-9 place-items-center rounded-full bg-ink text-night shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-40"
          :aria-label="player.isPlaying ? 'Pause' : 'Play'"
          :disabled="!player.track"
          @click="player.toggle()"
        >
          <Pause v-if="player.isPlaying" class="size-4" fill="currentColor" />
          <Play v-else class="size-4 translate-x-px" fill="currentColor" />
        </button>
        <button :class="button" aria-label="Next" :disabled="!player.track" @click="player.next()">
          <SkipForward class="size-4" fill="currentColor" />
        </button>
        <button
          v-if="player.track && player.signedIn"
          :class="[button, 'ml-1', liked && '!text-accent-soft']"
          :aria-label="liked ? 'Remove like' : 'Like'"
          :aria-pressed="liked"
          @click="player.like(liked ? 'INDIFFERENT' : 'LIKE')"
        >
          <ThumbsUp class="size-4" :fill="liked ? 'currentColor' : 'none'" />
        </button>
        <span class="pointer-events-none ml-auto text-[11px] text-ink-faint tabular-nums">
          {{ formatTime(shown) }} / {{ formatTime(duration) }}
        </span>
      </div>
    </div>

    <div class="absolute top-2 right-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
      <button
        :class="[corner, pinned && '!text-accent-soft']"
        :aria-label="pinned ? 'Stop keeping on top' : 'Keep on top'"
        :title="pinned ? 'Stop keeping on top' : 'Keep on top'"
        :aria-pressed="pinned"
        @click="togglePin"
      >
        <Pin v-if="pinned" class="size-3.5" />
        <PinOff v-else class="size-3.5" />
      </button>
      <button :class="corner" aria-label="Back to the full window" title="Back to the full window" @click="backToMain">
        <Maximize2 class="size-3.5" />
      </button>
    </div>

    <!-- Progress along the bottom edge; it grows on hover to be easy to grab. -->
    <div class="absolute inset-x-0 bottom-0 h-1 bg-white/10 transition-[height] hover:h-1.5">
      <div class="h-full bg-gradient-to-r from-accent to-accent-soft" :style="{ width: `${progress}%` }" />
      <input
        type="range"
        min="0"
        :max="Math.floor(duration)"
        step="1"
        :value="Math.floor(shown)"
        :disabled="!duration"
        aria-label="Position"
        class="absolute inset-x-0 bottom-0 h-3 w-full cursor-pointer opacity-0"
        @input="onSeekInput"
        @change="onSeekChange"
      />
    </div>
  </div>
</template>
