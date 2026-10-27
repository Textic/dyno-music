<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import EmptyState from "@/main/components/brand/EmptyState.vue";
import { usePlaybackPosition } from "@/main/composables/usePlaybackPosition";
import { fetchLyrics, type Lyrics } from "@/main/services/lyrics";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();
const position = usePlaybackPosition();

/** Lines are timed to the voice; showing them a moment early reads as on time. */
const LEAD_SEC = 0.25;

const lyrics = ref<Lyrics | null>(null);
const loading = ref(false);
const failed = ref(false);
const list = ref<HTMLElement | null>(null);

let controller: AbortController | null = null;
// Keyed on the song and its title: the title can arrive a moment after a new song starts.
watch(
  () => (player.state.isAd || !player.track ? "" : `${player.track.videoId}|${player.track.title}`),
  async () => {
    const track = player.state.isAd ? null : player.track;
    controller?.abort();
    lyrics.value = null;
    failed.value = false;
    if (!track) return;
    controller = new AbortController();
    const mine = controller;
    loading.value = true;
    try {
      const result = await fetchLyrics(
        {
          title: track.title,
          artist: track.artists[0]?.name ?? "",
          album: track.album,
          durationSec: track.durationSec,
        },
        mine.signal,
      );
      if (mine === controller) lyrics.value = result;
    } catch (err) {
      if (mine !== controller || mine.signal.aborted) return;
      failed.value = true;
      player.log({ level: "warn", message: `Lyrics: ${err}` });
    } finally {
      if (mine === controller) loading.value = false;
    }
  },
  { immediate: true },
);

/** Index of the line being sung; -1 before the first one. */
const current = computed(() => {
  if (lyrics.value?.kind !== "synced") return -1;
  const lines = lyrics.value.lines;
  const at = position.value + LEAD_SEC;
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeSec <= at) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
});

/** Follows the song, unless the user scrolled away to read; it picks up again a while later. */
let userScrolledAt = 0;
const FOLLOW_AGAIN_MS = 4000;
let scrollingOurselves = false;

watch(current, async (index) => {
  if (index < 0 || Date.now() - userScrolledAt < FOLLOW_AGAIN_MS) return;
  await nextTick();
  const line = list.value?.querySelector<HTMLElement>(`[data-line="${index}"]`);
  if (!line || !list.value) return;
  scrollingOurselves = true;
  const reduced =
    document.documentElement.dataset.motion === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  list.value.scrollTo({
    top: line.offsetTop - list.value.clientHeight / 2 + line.clientHeight / 2,
    behavior: reduced ? "auto" : "smooth",
  });
  setTimeout(() => (scrollingOurselves = false), 600);
});

function onUserScroll(): void {
  if (!scrollingOurselves) userScrolledAt = Date.now();
}

function seekTo(timeSec: number): void {
  userScrolledAt = 0;
  void player.seek(timeSec);
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <p v-if="loading" class="px-6 py-4 text-sm text-ink-faint">Looking for lyrics…</p>
    <EmptyState
      v-else-if="player.state.isAd"
      size="sm"
      mood="sleepy"
      title="Lyrics after the ad"
    />
    <EmptyState
      v-else-if="failed"
      size="sm"
      mood="sleepy"
      title="Couldn't load lyrics"
      message="LRCLIB didn't answer. Check your connection."
    />
    <EmptyState v-else-if="lyrics?.kind === 'instrumental'" size="sm" mood="listening" title="Instrumental" />
    <EmptyState
      v-else-if="!lyrics || lyrics.kind === 'none'"
      size="sm"
      mood="sleepy"
      title="No lyrics found"
      message="LRCLIB doesn't have this song yet."
    />

    <ol
      v-else-if="lyrics.kind === 'synced'"
      ref="list"
      class="lyrics-mask relative flex-1 overflow-y-auto px-6 py-[30vh]"
      @wheel.passive="onUserScroll"
      @touchmove.passive="onUserScroll"
    >
      <li v-for="(line, i) in lyrics.lines" :key="i" :data-line="i">
        <button
          class="block w-full rounded-lg py-1.5 text-left text-xl leading-snug font-bold tracking-tight transition-[color,opacity,transform] duration-300 select-text"
          :class="
            i === current
              ? 'scale-[1.02] text-ink'
              : i < current
                ? 'text-ink-faint opacity-70 hover:opacity-100'
                : 'text-ink-soft opacity-60 hover:opacity-100'
          "
          :aria-current="i === current ? 'true' : undefined"
          :title="`Play from here`"
          @click="seekTo(line.timeSec)"
        >
          {{ line.text || "♪" }}
        </button>
      </li>
    </ol>

    <p v-else class="flex-1 overflow-y-auto px-6 py-4 text-base leading-relaxed whitespace-pre-line text-ink-soft select-text">
      {{ lyrics.text }}
    </p>

    <p class="shrink-0 px-6 pt-2 pb-4 text-[11px] text-ink-faint">Lyrics from LRCLIB (lrclib.net)</p>
  </div>
</template>

<style scoped>
/* Lines fade out at the top and bottom edges. */
.lyrics-mask {
  mask-image: linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);
}
</style>
