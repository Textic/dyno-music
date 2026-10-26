<script setup lang="ts">
import { ListMusic, PictureInPicture2 } from "lucide-vue-next";
import CoverImage from "@/main/components/CoverImage.vue";
import LikeButtons from "@/main/components/player/LikeButtons.vue";
import SeekBar from "@/main/components/player/SeekBar.vue";
import TransportControls from "@/main/components/player/TransportControls.vue";
import VolumeControl from "@/main/components/player/VolumeControl.vue";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import * as api from "@/shared/api";

const player = usePlayerStore();
const ui = useUiStore();

function openMini(): void {
  api.openMiniPlayer().catch((err) => ui.toast(`Could not open the mini player: ${err}`, "error"));
}
</script>

<template>
  <!-- The only element with backdrop blur: it floats over scrolling content. -->
  <div
    class="absolute inset-x-6 bottom-5 z-30 mx-auto flex max-w-5xl items-center gap-5 rounded-3xl border border-white/10 bg-black/40 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-2xl"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <button
        class="group flex min-w-0 items-center gap-3 rounded-2xl text-left disabled:cursor-default"
        :disabled="!player.track"
        aria-label="Open now playing"
        @click="ui.nowPlayingOpen = true"
      >
        <span class="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white/5 transition group-enabled:group-hover:scale-105">
          <CoverImage :src="player.track?.thumbnail" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold group-enabled:group-hover:underline">
            {{ player.state.isAd ? "Ad" : (player.track?.title ?? "Nothing playing") }}
          </span>
          <span class="block truncate text-xs text-ink-soft">
            {{ player.artistNames || "Search for something to play" }}
          </span>
        </span>
      </button>
      <LikeButtons v-if="player.track && player.signedIn" class="hidden shrink-0 xl:flex" />
    </div>

    <div class="flex w-[clamp(220px,36vw,440px)] shrink-0 flex-col items-center gap-1.5">
      <TransportControls />
      <SeekBar />
    </div>

    <div class="flex flex-1 items-center justify-end gap-2">
      <button
        class="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink"
        :class="ui.queueOpen && '!bg-white/10 !text-ink'"
        aria-label="Queue"
        :aria-pressed="ui.queueOpen"
        @click="ui.queueOpen = !ui.queueOpen"
      >
        <ListMusic class="size-[18px]" />
      </button>
      <button
        class="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink"
        aria-label="Mini player"
        title="Mini player"
        @click="openMini"
      >
        <PictureInPicture2 class="size-[18px]" />
      </button>
      <VolumeControl class="hidden lg:flex" />
    </div>
  </div>
</template>
