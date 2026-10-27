<script setup lang="ts">
import { Play } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ArtistLinks from "@/main/components/ArtistLinks.vue";
import MediaCard from "@/main/components/MediaCard.vue";
import TrackList from "@/main/components/TrackList.vue";
import { useInfiniteScroll } from "@/main/composables/useInfiniteScroll";
import { useOpenItem } from "@/main/composables/useMedia";
import { search, searchMore } from "@/main/services/music";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import type { SearchFilter, SearchPage } from "@/shared/innertube/model";
import EmptyState from "@/main/components/brand/EmptyState.vue";

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();
const ui = useUiStore();
const open = useOpenItem();

const query = computed(() => (typeof route.query.q === "string" ? route.query.q.trim() : ""));
const filterLabel = computed(() => (typeof route.query.f === "string" ? route.query.f : ""));

const filters = ref<SearchFilter[]>([]);
const page = ref<SearchPage | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

/** Songs, videos and episodes read best as a list; albums, artists and playlists as cards. */
const asList = computed(() => {
  const items = page.value?.items ?? [];
  return !filterLabel.value || items.filter((i) => i.videoId).length >= items.length / 2;
});

async function load(): Promise<void> {
  if (!query.value) return;
  loading.value = true;
  error.value = null;
  try {
    // The unfiltered search also says which filters exist.
    const all = await search(query.value);
    filters.value = all.filters;
    const filter = all.filters.find((f) => f.label === filterLabel.value);
    page.value = filter ? await search(query.value, filter.params) : all;
  } catch (err) {
    error.value = String(err);
  } finally {
    loading.value = false;
  }
}

function selectFilter(label: string): void {
  void router.replace({ name: "search", query: { q: query.value, ...(label ? { f: label } : {}) } });
}

const { sentinel, loadingMore } = useInfiniteScroll(
  async () => {
    const current = page.value!;
    const more = await searchMore(current.continuation!);
    current.items.push(...more.items);
    current.continuation = more.continuation;
  },
  () => Boolean(page.value?.continuation),
);

onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-3xl font-extrabold tracking-tight">
      <template v-if="query">Results for “{{ query }}”</template>
      <template v-else>Search</template>
    </h1>

    <p v-if="!query" class="text-sm text-ink-soft">Type in the search bar above, or press Ctrl K.</p>

    <div v-if="filters.length" class="-mx-1 flex flex-wrap gap-2" role="tablist" aria-label="Filter results">
      <button
        v-for="tab in [{ label: '' }, ...filters]"
        :key="tab.label"
        role="tab"
        :aria-selected="filterLabel === tab.label"
        class="rounded-full px-4 py-1.5 text-sm font-medium transition"
        :class="filterLabel === tab.label ? 'bg-ink text-night' : 'glass glass-hover text-ink-soft'"
        @click="selectFilter(tab.label)"
      >
        {{ tab.label || "All" }}
      </button>
    </div>

    <ul v-if="loading" class="flex flex-col gap-1" aria-label="Loading results">
      <li v-for="n in 8" :key="n" class="flex animate-pulse items-center gap-4 px-3 py-2">
        <div class="size-11 rounded-lg bg-white/10" />
        <div class="flex-1 space-y-2">
          <div class="h-3 w-1/3 rounded bg-white/10" />
          <div class="h-2.5 w-1/4 rounded bg-white/5" />
        </div>
      </li>
    </ul>

    <EmptyState v-else-if="error" mood="sleepy" title="Search failed" :message="error"></EmptyState>

    <template v-else-if="page">
      <section v-if="page.top && !filterLabel" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div
          class="glass glass-hover group relative flex cursor-pointer flex-col gap-4 rounded-3xl p-5 transition"
          @click="open(page.top.item)"
          @contextmenu="ui.openMenu($event, page.top.item)"
        >
          <p class="text-xs font-semibold tracking-widest text-ink-faint uppercase">Top result</p>
          <img
            v-if="page.top.item.thumbnail"
            :src="page.top.item.thumbnail"
            alt=""
            class="size-28 object-cover shadow-xl shadow-shade/50"
            :class="page.top.item.kind === 'artist' ? 'rounded-full' : 'rounded-2xl'"
          />
          <div class="min-w-0">
            <p class="truncate text-2xl font-bold">{{ page.top.item.title }}</p>
            <p class="truncate text-sm text-ink-soft">
              <ArtistLinks v-if="page.top.item.artists.length" :artists="page.top.item.artists" />
              <template v-else>{{ page.top.item.subtitle }}</template>
            </p>
          </div>
          <button
            v-if="page.top.item.videoId || page.top.item.playlistId"
            class="absolute right-5 bottom-5 grid size-12 place-items-center rounded-full bg-accent opacity-0 shadow-xl shadow-shade/50 transition group-hover:opacity-100 hover:scale-105"
            :aria-label="`Play ${page.top.item.title}`"
            @click.stop="player.play(page.top.item)"
          >
            <Play class="size-5 translate-x-px" fill="currentColor" />
          </button>
        </div>
        <TrackList v-if="page.top.related.length" :items="page.top.related" />
      </section>

      <EmptyState
        v-if="!page.items.length && !page.top"
        mood="sleepy"
        title="No results"
        message="Dyno looked everywhere. Try other words or another filter."
      />

      <TrackList v-else-if="asList" :items="page.items" />
      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
        <MediaCard v-for="(item, i) in page.items" :key="i" :item="item" />
      </div>

      <div :ref="sentinel" class="h-px" />
      <p v-if="loadingMore" class="text-center text-sm text-ink-faint">Loading more…</p>
    </template>
  </div>
</template>
