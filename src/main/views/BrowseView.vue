<script setup lang="ts">
import { Music, Play, Radio, Shuffle } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import ArtistLinks from "@/main/components/ArtistLinks.vue";
import MediaShelf from "@/main/components/MediaShelf.vue";
import TrackList from "@/main/components/TrackList.vue";
import { useInfiniteScroll } from "@/main/composables/useInfiniteScroll";
import { browse, browseMore } from "@/main/services/music";
import { usePlayerStore } from "@/main/stores/player";
import type { BrowsePage } from "@/shared/innertube/model";
import EmptyState from "@/main/components/brand/EmptyState.vue";

const route = useRoute();
const player = usePlayerStore();

const browseId = computed(() => String(route.params.id));
const params = computed(() => (typeof route.query.params === "string" ? route.query.params : undefined));

const page = ref<BrowsePage | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const showFullDescription = ref(false);

const header = computed(() => page.value?.header);
/** Albums and playlists show their tracks as the main list; it is always the first shelf. */
const isTrackPage = computed(() => header.value?.kind === "album" || header.value?.kind === "playlist");
const trackShelf = computed(() => (isTrackPage.value ? page.value?.shelves[0] : undefined));
const otherShelves = computed(() => (trackShelf.value ? page.value!.shelves.slice(1) : (page.value?.shelves ?? [])));

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    page.value = await browse(browseId.value, params.value, { onUpdate: (fresh) => (page.value = fresh) });
  } catch (err) {
    error.value = String(err);
  } finally {
    loading.value = false;
  }
}

const { sentinel, loadingMore } = useInfiniteScroll(
  async () => {
    const current = page.value!;
    const more = await browseMore(current.continuation!);
    if (trackShelf.value) trackShelf.value.items.push(...more.items);
    current.shelves.push(...more.shelves);
    current.continuation = more.continuation;
  },
  () => Boolean(page.value?.continuation),
);

onMounted(load);
</script>

<template>
  <div v-if="loading" class="flex animate-pulse flex-col gap-8" aria-label="Loading">
    <div class="flex items-end gap-6">
      <div class="size-52 rounded-3xl bg-white/10" />
      <div class="flex-1 space-y-3">
        <div class="h-8 w-1/2 rounded bg-white/10" />
        <div class="h-4 w-1/3 rounded bg-white/5" />
      </div>
    </div>
    <div v-for="n in 6" :key="n" class="h-12 rounded-xl bg-white/[0.05]" />
  </div>

  <EmptyState v-else-if="error" mood="sleepy" title="Couldn't load this page" :message="error">
      <button class="glass glass-hover rounded-xl px-4 py-2 text-sm" @click="load">Try again</button>
    </EmptyState>

  <div v-else-if="page" class="flex flex-col gap-10">
    <!-- Artist: wide hero image. -->
    <header
      v-if="header?.kind === 'artist'"
      class="relative -mx-8 -mt-2 flex min-h-72 items-end overflow-hidden px-8 pb-8"
    >
      <img
        v-if="header.thumbnail"
        :src="header.thumbnail"
        alt=""
        class="absolute inset-0 -z-10 size-full object-cover object-[center_25%] opacity-70"
      />
      <div class="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/40 to-transparent" />
      <div class="max-w-3xl">
        <h1 class="text-6xl font-black tracking-tight drop-shadow-lg">{{ header.title }}</h1>
        <p class="mt-2 text-sm text-ink-soft">{{ header.subtitle }}</p>
        <div class="mt-5 flex gap-3">
          <button
            v-if="header.playlistId"
            class="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold shadow-xl shadow-accent/30 transition hover:brightness-110"
            @click="player.playList(header.playlistId)"
          >
            <Shuffle class="size-4" /> Shuffle
          </button>
          <button
            v-if="header.radioPlaylistId"
            class="glass glass-hover inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
            @click="player.playList(header.radioPlaylistId)"
          >
            <Radio class="size-4" /> Radio
          </button>
        </div>
      </div>
    </header>

    <!-- Album or playlist: artwork beside the details. -->
    <header v-else-if="header" class="flex flex-col gap-6 sm:flex-row sm:items-end">
      <div class="size-52 shrink-0 overflow-hidden rounded-3xl bg-white/5 shadow-2xl shadow-black/60 xl:size-60">
        <img v-if="header.thumbnail" :src="header.thumbnail" alt="" class="size-full object-cover" />
        <Music v-else class="m-auto size-full p-16 text-ink-faint" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold tracking-widest text-ink-faint uppercase">{{ header.subtitle }}</p>
        <h1 class="mt-2 text-4xl font-black tracking-tight xl:text-5xl">{{ header.title }}</h1>
        <p v-if="header.artists.length" class="mt-2 text-sm font-medium text-ink-soft">
          <ArtistLinks :artists="header.artists" />
        </p>
        <p v-if="header.secondSubtitle" class="mt-1 text-xs text-ink-faint">{{ header.secondSubtitle }}</p>
        <p
          v-if="header.description"
          class="mt-3 max-w-2xl cursor-pointer text-sm whitespace-pre-line text-ink-soft select-text"
          :class="!showFullDescription && 'line-clamp-2'"
          :title="showFullDescription ? '' : 'Show more'"
          @click="showFullDescription = !showFullDescription"
        >
          {{ header.description }}
        </p>
        <div v-if="header.playlistId" class="mt-5 flex gap-3">
          <button
            class="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold shadow-xl shadow-accent/30 transition hover:brightness-110"
            @click="player.playList(header.playlistId)"
          >
            <Play class="size-4" fill="currentColor" /> Play
          </button>
          <button
            class="glass glass-hover inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
            @click="player.playList(header.playlistId, { shuffle: true })"
          >
            <Shuffle class="size-4" /> Shuffle
          </button>
        </div>
      </div>
    </header>

    <TrackList
      v-if="trackShelf"
      :items="trackShelf.items"
      :context="header?.playlistId"
      :show-index="header?.kind === 'album'"
      :show-album="header?.kind !== 'album'"
    />

    <MediaShelf v-for="(shelf, i) in otherShelves" :key="i" :shelf="shelf" />

    <EmptyState v-if="!page.shelves.length" title="Nothing here yet" />

    <div :ref="sentinel" class="h-px" />
    <p v-if="loadingMore" class="text-center text-sm text-ink-faint">Loading more…</p>
  </div>
</template>
