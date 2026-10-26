<script setup lang="ts">
import { LogIn } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import MediaShelf from "@/main/components/MediaShelf.vue";
import { useInfiniteScroll } from "@/main/composables/useInfiniteScroll";
import { browse, browseMore, HOME } from "@/main/services/music";
import { usePlayerStore } from "@/main/stores/player";
import type { BrowsePage, Shelf } from "@/shared/innertube/model";
import DynoMascot from "@/main/components/brand/DynoMascot.vue";
import EmptyState from "@/main/components/brand/EmptyState.vue";

const player = usePlayerStore();

const shelves = ref<Shelf[]>([]);
const continuation = ref<string | undefined>();
const loading = ref(true);
const error = ref<string | null>(null);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night listening";
  if (hour < 12) return "Good morning";
  if (hour < 19) return "Good afternoon";
  return "Good evening";
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const apply = (page: BrowsePage) => {
      shelves.value = page.shelves;
      continuation.value = page.continuation;
    };
    apply(await browse(HOME, undefined, { onUpdate: apply }));
  } catch (err) {
    error.value = String(err);
  } finally {
    loading.value = false;
  }
}

const { sentinel, loadingMore } = useInfiniteScroll(
  async () => {
    const more = await browseMore(continuation.value!);
    shelves.value.push(...more.shelves);
    continuation.value = more.continuation;
  },
  () => Boolean(continuation.value),
);

onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-10">
    <h1 class="text-4xl font-extrabold tracking-tight">{{ greeting }}</h1>

    <section
      v-if="player.session && !player.session.loggedIn"
      class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent/30 via-fuchsia-600/20 to-indigo-600/20 p-8"
    >
      <h2 class="text-2xl font-bold">Bring your music with you</h2>
      <p class="mt-2 max-w-md text-sm text-ink-soft">
        Sign in with your Google account for recommendations made for you, your library, liked songs and playlists.
      </p>
      <button
        class="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-night transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60"
        :disabled="player.signingIn"
        @click="player.signIn()"
      >
        <LogIn class="size-4" />
        {{ player.signingIn ? "Waiting for Google…" : "Sign in with Google" }}
      </button>
    </section>

    <div v-if="loading" class="flex flex-col gap-10" aria-label="Loading recommendations">
      <div class="flex items-center gap-3 text-sm text-ink-soft">
        <DynoMascot mood="listening" class="size-14" />
        Picking music for you…
      </div>
      <div v-for="n in 3" :key="n" class="flex animate-pulse flex-col gap-3">
        <div class="h-5 w-48 rounded bg-white/10" />
        <div class="flex gap-4 overflow-hidden">
          <div v-for="m in 7" :key="m" class="aspect-square w-40 shrink-0 rounded-2xl bg-white/[0.07]" />
        </div>
      </div>
    </div>

    <EmptyState v-else-if="error" mood="sleepy" title="Couldn't load your recommendations" :message="error">
      <button class="glass glass-hover rounded-xl px-4 py-2 text-sm" @click="load">Try again</button>
    </EmptyState>

    <template v-else>
      <MediaShelf v-for="(shelf, i) in shelves" :key="i" :shelf="shelf" />
      <div :ref="sentinel" class="h-px" />
      <p v-if="loadingMore" class="text-center text-sm text-ink-faint">Loading more…</p>
    </template>
  </div>
</template>
