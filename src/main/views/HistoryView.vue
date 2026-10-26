<script setup lang="ts">
import { LogIn } from "lucide-vue-next";
import { ref, watch } from "vue";
import MediaShelf from "@/main/components/MediaShelf.vue";
import { useInfiniteScroll } from "@/main/composables/useInfiniteScroll";
import { browse, browseMore, HISTORY } from "@/main/services/music";
import { usePlayerStore } from "@/main/stores/player";
import type { Shelf } from "@/shared/innertube/model";
import EmptyState from "@/main/components/brand/EmptyState.vue";
import DynoMascot from "@/main/components/brand/DynoMascot.vue";

const player = usePlayerStore();

/** One shelf per day ("Today", "Yesterday", ...), as YouTube Music groups it. */
const shelves = ref<Shelf[]>([]);
const continuation = ref<string | undefined>();
const loading = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  if (!player.signedIn) return;
  loading.value = true;
  error.value = null;
  try {
    const page = await browse(HISTORY);
    shelves.value = page.shelves;
    continuation.value = page.continuation;
  } catch (err) {
    error.value = String(err);
  } finally {
    loading.value = false;
  }
}

watch(() => player.signedIn, load, { immediate: true });

const { sentinel, loadingMore } = useInfiniteScroll(
  async () => {
    const more = await browseMore(continuation.value!);
    shelves.value.push(...more.shelves);
    continuation.value = more.continuation;
  },
  () => Boolean(continuation.value),
);
</script>

<template>
  <div class="flex flex-col gap-8">
    <h1 class="text-3xl font-extrabold tracking-tight">History</h1>

    <div v-if="!player.signedIn" class="glass flex flex-col items-start gap-3 rounded-3xl p-8">
      <DynoMascot mood="listening" class="size-24" />
      <h2 class="text-xl font-bold">Your history lives in your account</h2>
      <p class="max-w-md text-sm text-ink-soft">
        Sign in to see what you've listened to, here and on your other devices.
      </p>
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
      <ul v-if="loading" class="flex flex-col gap-1" aria-label="Loading history">
        <li v-for="n in 10" :key="n" class="flex animate-pulse items-center gap-4 px-3 py-2">
          <div class="size-11 rounded-lg bg-white/10" />
          <div class="flex-1 space-y-2">
            <div class="h-3 w-1/3 rounded bg-white/10" />
            <div class="h-2.5 w-1/4 rounded bg-white/5" />
          </div>
        </li>
      </ul>

      <EmptyState v-else-if="error" mood="sleepy" title="Couldn't load your history" :message="error">
      <button class="glass glass-hover rounded-xl px-4 py-2 text-sm" @click="load">Try again</button>
    </EmptyState>

      <EmptyState v-else-if="!shelves.length" mood="listening" title="Nothing played yet" message="Play something and it will show up here." />

      <MediaShelf v-for="(shelf, i) in shelves" v-else :key="i" :shelf="shelf" />

      <div :ref="sentinel" class="h-px" />
      <p v-if="loadingMore" class="text-center text-sm text-ink-faint">Loading more…</p>
    </template>
  </div>
</template>
