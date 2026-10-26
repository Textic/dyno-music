<script setup lang="ts">
import { Heart, LogIn } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import MediaCard from "@/main/components/MediaCard.vue";
import TrackList from "@/main/components/TrackList.vue";
import { useInfiniteScroll } from "@/main/composables/useInfiniteScroll";
import { browse, browseMore, LIBRARY, LIKED_SONGS } from "@/main/services/music";
import { usePlayerStore } from "@/main/stores/player";
import type { MediaItem } from "@/shared/innertube/model";

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();

const TABS = [
  { id: "playlists", label: "Playlists", browseId: LIBRARY.playlists },
  { id: "songs", label: "Liked songs", browseId: LIKED_SONGS },
  { id: "albums", label: "Albums", browseId: LIBRARY.albums },
  { id: "artists", label: "Artists", browseId: LIBRARY.artists },
] as const;

const tab = computed(() => TABS.find((t) => t.id === route.params.tab) ?? TABS[0]);
const items = ref<MediaItem[]>([]);
const continuation = ref<string | undefined>();
const loading = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  if (!player.signedIn) return;
  loading.value = true;
  error.value = null;
  try {
    const page = await browse(tab.value.browseId);
    // YouTube Music's own "New playlist" tile is not content.
    items.value = page.shelves.flatMap((s) => s.items).filter((i) => i.kind !== "unknown");
    continuation.value = page.continuation;
  } catch (err) {
    error.value = String(err);
  } finally {
    loading.value = false;
  }
}

watch([() => tab.value.id, () => player.signedIn], load, { immediate: true });

const { sentinel, loadingMore } = useInfiniteScroll(
  async () => {
    const more = await browseMore(continuation.value!);
    items.value.push(...more.items, ...more.shelves.flatMap((s) => s.items));
    continuation.value = more.continuation;
  },
  () => Boolean(continuation.value),
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-3xl font-extrabold tracking-tight">Library</h1>

    <div v-if="!player.signedIn" class="glass flex flex-col items-start gap-3 rounded-3xl p-8">
      <Heart class="size-8 text-accent-soft" />
      <h2 class="text-xl font-bold">Your library lives in your account</h2>
      <p class="max-w-md text-sm text-ink-soft">Sign in to see your playlists, liked songs, albums and artists.</p>
      <button
        class="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
        :disabled="player.signingIn"
        @click="player.signIn()"
      >
        <LogIn class="size-4" />
        {{ player.signingIn ? "Waiting for Google…" : "Sign in with Google" }}
      </button>
    </div>

    <template v-else>
      <div class="-mx-1 flex flex-wrap gap-2" role="tablist" aria-label="Library sections">
        <button
          v-for="t in TABS"
          :key="t.id"
          role="tab"
          :aria-selected="tab.id === t.id"
          class="rounded-full px-4 py-1.5 text-sm font-medium transition"
          :class="tab.id === t.id ? 'bg-ink text-night' : 'glass glass-hover text-ink-soft'"
          @click="router.replace({ name: 'library', params: { tab: t.id } })"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-if="loading" class="grid animate-pulse grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
        <div v-for="n in 12" :key="n" class="aspect-square rounded-2xl bg-white/[0.07]" />
      </div>

      <div v-else-if="error" class="glass rounded-2xl p-5 text-sm">
        <p class="font-semibold">Couldn't load your library</p>
        <p class="mt-1 text-ink-soft">{{ error }}</p>
        <button class="glass glass-hover mt-3 rounded-xl px-3 py-1.5" @click="load">Try again</button>
      </div>

      <p v-else-if="!items.length" class="text-sm text-ink-faint">Nothing here yet.</p>

      <TrackList v-else-if="tab.id === 'songs'" :items="items" :context="LIKED_SONGS.slice(2)" />

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
        <MediaCard v-for="(item, i) in items" :key="i" :item="item" />
      </div>

      <div :ref="sentinel" class="h-px" />
      <p v-if="loadingMore" class="text-center text-sm text-ink-faint">Loading more…</p>
    </template>
  </div>
</template>
