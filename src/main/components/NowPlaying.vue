<script setup lang="ts">
import { ChevronDown, Disc3 } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CoverImage from "@/main/components/CoverImage.vue";
import LikeButtons from "@/main/components/player/LikeButtons.vue";
import SeekBar from "@/main/components/player/SeekBar.vue";
import TransportControls from "@/main/components/player/TransportControls.vue";
import VolumeControl from "@/main/components/player/VolumeControl.vue";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";

const player = usePlayerStore();
const ui = useUiStore();
const list = ref<HTMLElement | null>(null);

const currentIndex = computed(() => player.queue.findIndex((e) => e.selected));
const upNext = computed(() => player.queue.slice(Math.max(currentIndex.value, 0)));

function close(): void {
  ui.nowPlayingOpen = false;
}

// Nothing left to show.
watch(
  () => player.track,
  (track) => {
    if (!track) close();
  },
);

watch(
  () => ui.nowPlayingOpen,
  async (open) => {
    if (open) {
      await nextTick();
      list.value?.scrollTo({ top: 0 });
    }
  },
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && ui.nowPlayingOpen && !ui.menu) close();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    leave-active-class="transition duration-200 ease-in"
    enter-from-class="translate-y-6 opacity-0"
    leave-to-class="translate-y-6 opacity-0"
  >
    <section
      v-if="ui.nowPlayingOpen && player.track"
      class="absolute inset-0 z-[35] flex overflow-hidden bg-night"
      aria-label="Now playing"
    >
      <!-- Its own, stronger take on the ambient background. -->
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <img
          v-if="player.track.thumbnail"
          :src="player.track.thumbnail"
          alt=""
          class="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-[100px] saturate-150"
        />
        <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/80" />
      </div>

      <button
        class="absolute top-4 left-5 z-10 grid size-10 place-items-center rounded-full bg-black/30 text-ink-soft transition hover:bg-black/50 hover:text-ink"
        aria-label="Close now playing"
        @click="close"
      >
        <ChevronDown class="size-5" />
      </button>

      <div class="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-8 px-10 py-14">
        <div
          class="aspect-square w-[min(52vh,42vw)] overflow-hidden rounded-[2rem] bg-white/5 shadow-[0_40px_120px_-20px] shadow-black/80"
        >
          <CoverImage :src="player.track.thumbnail" />
        </div>

        <div class="flex w-full max-w-xl flex-col items-center gap-1 text-center">
          <h1 class="line-clamp-2 text-3xl font-black tracking-tight xl:text-4xl">
            {{ player.state.isAd ? "Ad" : player.track.title }}
          </h1>
          <p class="truncate text-base text-ink-soft">{{ player.artistNames }}</p>
          <p v-if="player.track.album" class="flex items-center gap-1.5 truncate text-sm text-ink-faint">
            <Disc3 class="size-3.5" /> {{ player.track.album }}
          </p>
        </div>

        <div class="flex w-full max-w-xl flex-col items-center gap-4">
          <SeekBar large />
          <TransportControls large />
          <div class="flex items-center gap-6">
            <LikeButtons v-if="player.signedIn" />
            <VolumeControl />
          </div>
        </div>
      </div>

      <aside class="relative hidden w-80 shrink-0 flex-col border-l border-white/10 bg-black/25 lg:flex xl:w-96" aria-label="Up next">
        <h2 class="px-6 pt-6 pb-3 text-sm font-bold tracking-widest text-ink-faint uppercase">Up next</h2>
        <p v-if="!upNext.length" class="px-6 text-sm text-ink-faint">Nothing queued.</p>
        <ol ref="list" class="flex-1 overflow-y-auto px-3 pb-6">
          <li
            v-for="entry in upNext"
            :key="`${entry.index}-${entry.videoId}`"
            class="group flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/[0.07]"
            :class="entry.selected && 'bg-white/10'"
            @dblclick="player.queuePlay(entry.index)"
          >
            <button
              class="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white/5"
              :aria-label="`Play ${entry.title}`"
              @click="player.queuePlay(entry.index)"
            >
              <CoverImage :src="entry.thumbnail" lazy />
            </button>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium" :class="entry.selected && 'text-accent-soft'">{{ entry.title }}</p>
              <p class="truncate text-xs text-ink-faint">{{ entry.artists }}</p>
            </div>
            <span class="text-[11px] text-ink-faint tabular-nums">{{ entry.duration }}</span>
          </li>
        </ol>
      </aside>
    </section>
  </Transition>
</template>
