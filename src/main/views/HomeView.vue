<script setup lang="ts">
import { Library, LogIn, Pause, Play, Search } from "lucide-vue-next";
import { computed } from "vue";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night listening";
  if (hour < 12) return "Good morning";
  if (hour < 19) return "Good afternoon";
  return "Good evening";
});

const tiles = [
  { to: { name: "search" }, title: "Search", subtitle: "Songs, artists and albums", icon: Search },
];
</script>

<template>
  <div class="flex flex-col gap-10">
    <h1 class="text-4xl font-extrabold tracking-tight">{{ greeting }}</h1>

    <section
      v-if="player.track"
      class="glass flex items-center gap-6 overflow-hidden rounded-3xl p-5"
      aria-label="Now playing"
    >
      <img :src="player.track.thumbnail" alt="" class="size-36 rounded-2xl object-cover shadow-2xl shadow-black/60" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold tracking-widest text-ink-faint uppercase">Now playing</p>
        <p class="mt-2 truncate text-3xl font-bold">{{ player.track.title }}</p>
        <p class="mt-1 truncate text-ink-soft">{{ player.artistNames }}</p>
      </div>
      <button
        class="mr-2 grid size-16 shrink-0 place-items-center rounded-full bg-accent shadow-xl shadow-accent/30 transition hover:scale-105 active:scale-95"
        :aria-label="player.isPlaying ? 'Pause' : 'Play'"
        @click="player.toggle()"
      >
        <Pause v-if="player.isPlaying" class="size-7" fill="currentColor" />
        <Play v-else class="size-7 translate-x-0.5" fill="currentColor" />
      </button>
    </section>

    <section
      v-if="player.session && !player.session.loggedIn"
      class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent/30 via-fuchsia-600/20 to-indigo-600/20 p-8"
    >
      <h2 class="text-2xl font-bold">Bring your music with you</h2>
      <p class="mt-2 max-w-md text-sm text-ink-soft">
        Sign in with your Google account to see your library, liked songs and playlists. You can still search and
        play without signing in.
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

    <section class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      <RouterLink
        v-for="tile in tiles"
        :key="tile.title"
        :to="tile.to"
        class="glass glass-hover flex items-center gap-4 rounded-2xl p-4 transition"
      >
        <span class="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent-soft">
          <component :is="tile.icon" class="size-5" />
        </span>
        <span>
          <span class="block text-sm font-semibold">{{ tile.title }}</span>
          <span class="block text-xs text-ink-faint">{{ tile.subtitle }}</span>
        </span>
      </RouterLink>
      <div class="glass flex cursor-default items-center gap-4 rounded-2xl p-4 opacity-60">
        <span class="grid size-11 place-items-center rounded-xl bg-white/5 text-ink-faint">
          <Library class="size-5" />
        </span>
        <span>
          <span class="block text-sm font-semibold">Library</span>
          <span class="block text-xs text-ink-faint">Coming soon</span>
        </span>
      </div>
    </section>
  </div>
</template>
