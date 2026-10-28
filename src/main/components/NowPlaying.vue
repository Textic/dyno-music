<script setup lang="ts">
import { ChevronDown, Disc3, ListMusic, MicVocal } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CoverImage from "@/main/components/CoverImage.vue";
import LyricsPanel from "@/main/components/LyricsPanel.vue";
import LikeButtons from "@/main/components/player/LikeButtons.vue";
import SeekBar from "@/main/components/player/SeekBar.vue";
import TransportControls from "@/main/components/player/TransportControls.vue";
import VolumeControl from "@/main/components/player/VolumeControl.vue";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import EmptyState from "@/main/components/brand/EmptyState.vue";

const player = usePlayerStore();
const ui = useUiStore();
const list = ref<HTMLElement | null>(null);

type Panel = "queue" | "lyrics" | "none";

/** The side panel shown ("Up next", lyrics or nothing); remembered between launches. */
const PANEL_KEY = "dyno.nowPlaying.panel";
function readPanel(): Panel {
  try {
    const stored = localStorage.getItem(PANEL_KEY);
    // Older versions only remembered whether "Up next" was hidden.
    if (localStorage.getItem("dyno.nowPlaying.showQueue") === "false" && !stored) return "none";
    return stored === "lyrics" || stored === "none" ? stored : "queue";
  } catch {
    return "queue";
  }
}
const panel = ref<Panel>(readPanel());
watch(panel, (next) => {
  try {
    localStorage.setItem(PANEL_KEY, next);
  } catch {
    // Not remembered; it still works for this session.
  }
});
const showPanel = computed(() => panel.value !== "none");

/** The panel button toggles its panel, or switches from the other one. */
function togglePanel(which: Panel): void {
  panel.value = panel.value === which ? "none" : which;
}

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

const panelButton =
  "grid size-10 place-items-center rounded-full bg-black/30 text-ink-soft transition hover:bg-black/50 hover:text-ink";

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
      class="absolute inset-0 z-[35] flex overflow-hidden bg-night pt-14"
      aria-label="Now playing"
    >
      <!-- Its own, stronger take on the ambient background, with the same cross-fade between
           songs (see AmbientBackground). -->
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <div class="absolute inset-0 scale-125 opacity-70 blur-[100px] saturate-150">
          <Transition
            enter-active-class="z-[1] transition-opacity duration-[1600ms] ease-out"
            leave-active-class="transition-opacity duration-[1600ms] ease-in"
            enter-from-class="opacity-0"
            :leave-to-class="player.track.thumbnail ? '' : 'opacity-0'"
          >
            <img
              v-if="player.track.thumbnail"
              :key="player.track.thumbnail"
              :src="player.track.thumbnail"
              alt=""
              class="absolute inset-0 size-full object-cover"
            />
          </Transition>
        </div>
        <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/80" />
      </div>

      <button
        class="absolute top-[4.5rem] left-5 z-10 grid size-10 place-items-center rounded-full bg-black/30 text-ink-soft transition hover:bg-black/50 hover:text-ink"
        aria-label="Close now playing"
        @click="close"
      >
        <ChevronDown class="size-5" />
      </button>

      <div class="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-8 px-10 py-14">
        <div class="absolute top-4 right-5 hidden gap-2 lg:flex">
          <button
            :class="[panelButton, panel === 'lyrics' && '!bg-white/15 !text-ink']"
            :aria-label="panel === 'lyrics' ? 'Hide lyrics' : 'Show lyrics'"
            :title="panel === 'lyrics' ? 'Hide lyrics' : 'Show lyrics'"
            :aria-pressed="panel === 'lyrics'"
            @click="togglePanel('lyrics')"
          >
            <MicVocal class="size-5" />
          </button>
          <button
            :class="[panelButton, panel === 'queue' && '!bg-white/15 !text-ink']"
            :aria-label="panel === 'queue' ? 'Hide up next' : 'Show up next'"
            :title="panel === 'queue' ? 'Hide up next' : 'Show up next'"
            :aria-pressed="panel === 'queue'"
            @click="togglePanel('queue')"
          >
            <ListMusic class="size-5" />
          </button>
        </div>
        <!-- The artwork itself plays and pauses, like a big play button. -->
        <button
          class="aspect-square w-[min(52vh,42vw)] overflow-hidden rounded-[2rem] bg-white/5 shadow-[0_40px_120px_-20px] shadow-shade/80 transition hover:brightness-110 active:scale-[0.99]"
          :aria-label="player.isPlaying ? 'Pause' : 'Play'"
          :title="player.isPlaying ? 'Pause' : 'Play'"
          @click="player.toggle()"
        >
          <CoverImage :src="player.track.thumbnail" />
        </button>

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

      <!-- Kept mounted on wide screens so opening and closing can animate its width: the artwork
           and controls glide to their new centre instead of jumping. -->
      <aside
        class="relative hidden shrink-0 overflow-hidden border-l bg-black/25 transition-[width,opacity,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block"
        :class="showPanel ? 'w-80 border-white/10 opacity-100 xl:w-96' : 'w-0 border-transparent opacity-0'"
        :inert="!showPanel"
        :aria-hidden="!showPanel"
        :aria-label="panel === 'lyrics' ? 'Lyrics' : 'Up next'"
      >
        <div
          class="flex h-full w-80 flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] xl:w-96"
          :class="showPanel ? 'translate-x-0' : 'translate-x-10'"
        >
          <h2 class="px-6 pt-6 pb-3 text-sm font-bold tracking-widest text-ink-faint uppercase">
            {{ panel === "lyrics" ? "Lyrics" : "Up next" }}
          </h2>
          <!-- Only looked up while shown, so nothing goes to LRCLIB unless lyrics are open. -->
          <LyricsPanel v-if="panel === 'lyrics'" />
          <EmptyState v-else-if="!upNext.length" size="sm" mood="listening" title="Nothing queued" />
          <!-- Re-created on every opening so the songs cascade in again. -->
          <ol v-if="panel === 'queue'" ref="list" class="flex-1 overflow-y-auto px-3 pb-6">
            <li
              v-for="(entry, i) in upNext"
              :key="`${entry.index}-${entry.videoId}`"
              class="queue-item group flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/[0.07]"
              :class="entry.selected && 'bg-white/10'"
              :style="{ animationDelay: `${Math.min(i, 12) * 35}ms` }"
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
        </div>
      </aside>
    </section>
  </Transition>
</template>

<style scoped>
.queue-item {
  animation: queue-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes queue-in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
}
</style>
