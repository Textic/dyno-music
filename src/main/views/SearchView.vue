<script setup lang="ts">
import { SearchX } from "lucide-vue-next";
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import TrackRow from "@/main/components/TrackRow.vue";
import { usePlayerStore } from "@/main/stores/player";
import * as api from "@/shared/api";
import { parseSearch, type SearchItem } from "@/shared/innertube/parsers";

const route = useRoute();
const player = usePlayerStore();

const results = ref<SearchItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const query = ref("");

/** Ignores responses to searches that a newer one replaced. */
let latest = 0;

async function search(q: string): Promise<void> {
  const id = ++latest;
  query.value = q;
  loading.value = true;
  error.value = null;
  try {
    const items = parseSearch(await api.ytmApi("search", { query: q }));
    if (id === latest) results.value = items;
  } catch (err) {
    if (id === latest) error.value = String(err);
  } finally {
    if (id === latest) loading.value = false;
  }
}

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === "string" && q.trim()) void search(q.trim());
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <h1 class="text-3xl font-extrabold tracking-tight">
      <template v-if="query">Results for “{{ query }}”</template>
      <template v-else>Search</template>
    </h1>

    <p v-if="!query" class="mt-3 text-sm text-ink-soft">Type in the search bar above, or press Ctrl K.</p>

    <ul v-if="loading" class="mt-6 flex flex-col gap-1" aria-label="Loading results">
      <li v-for="n in 8" :key="n" class="flex animate-pulse items-center gap-4 px-3 py-2">
        <div class="size-12 rounded-lg bg-white/10" />
        <div class="flex-1 space-y-2">
          <div class="h-3 w-1/3 rounded bg-white/10" />
          <div class="h-2.5 w-1/4 rounded bg-white/5" />
        </div>
      </li>
    </ul>

    <div v-else-if="error" class="glass mt-6 rounded-2xl p-5 text-sm">
      <p class="font-semibold">Search failed</p>
      <p class="mt-1 text-ink-soft">{{ error }}</p>
    </div>

    <div v-else-if="query && !results.length" class="mt-16 flex flex-col items-center text-ink-faint">
      <SearchX class="size-10" />
      <p class="mt-3 text-sm">No playable results</p>
    </div>

    <ul v-else class="mt-6 flex flex-col gap-0.5">
      <TrackRow
        v-for="item in results"
        :key="item.videoId"
        :item="item"
        :current="player.track?.videoId === item.videoId"
        @play="player.playVideo(item.videoId)"
      />
    </ul>
  </div>
</template>
