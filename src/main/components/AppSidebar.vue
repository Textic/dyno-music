<script setup lang="ts">
import { House, Library, LogIn, Search } from "lucide-vue-next";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();

const links = [
  { to: { name: "home" }, label: "Home", icon: House },
  { to: { name: "search" }, label: "Search", icon: Search },
];
</script>

<template>
  <!-- Icons only on narrow windows, labels from lg up. -->
  <aside class="flex w-[76px] shrink-0 flex-col gap-6 px-3 py-5 lg:w-60 lg:px-4">
    <div class="flex items-center justify-center gap-2.5 lg:justify-start lg:px-2">
      <div
        class="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-fuchsia-500 text-lg font-black shadow-lg shadow-accent/30"
      >
        D
      </div>
      <span class="hidden text-xl font-extrabold tracking-tight lg:inline">dyno</span>
    </div>

    <nav class="flex flex-col gap-1">
      <RouterLink
        v-for="link in links"
        :key="link.label"
        :to="link.to"
        :title="link.label"
        class="flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-white/5 hover:text-ink lg:justify-start"
        active-class="!bg-white/10 !text-ink"
      >
        <component :is="link.icon" class="size-[18px] shrink-0" />
        <span class="hidden lg:inline">{{ link.label }}</span>
      </RouterLink>
      <span
        class="flex cursor-default items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-faint lg:justify-start"
        title="Library: coming in phase 2"
      >
        <Library class="size-[18px] shrink-0" />
        <span class="hidden lg:inline">Library</span>
        <span class="ml-auto hidden rounded-full bg-white/5 px-2 py-0.5 text-[10px] tracking-wide uppercase lg:inline">
          Soon
        </span>
      </span>
    </nav>

    <!-- Narrow: just the session state. -->
    <div class="mt-auto flex justify-center lg:hidden">
      <span
        v-if="player.session?.loggedIn"
        class="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400"
        title="Signed in"
      />
      <button
        v-else-if="player.session"
        class="grid size-10 place-items-center rounded-xl bg-accent transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
        :disabled="player.signingIn"
        title="Sign in with Google"
        @click="player.signIn()"
      >
        <LogIn class="size-4" />
      </button>
    </div>

    <div class="glass mt-auto hidden rounded-2xl p-4 lg:block">
      <template v-if="!player.session">
        <p class="text-sm text-ink-soft">Connecting to YouTube Music…</p>
      </template>
      <template v-else-if="player.session.loggedIn">
        <p class="flex items-center gap-2 text-sm font-medium">
          <span class="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" />
          Signed in
        </p>
        <p class="mt-1 text-xs text-ink-faint">Your library and playlists are available.</p>
      </template>
      <template v-else>
        <p class="text-sm font-medium">Not signed in</p>
        <p class="mt-1 text-xs text-ink-faint">Sign in to use your library, likes and playlists.</p>
        <button
          class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          :disabled="player.signingIn"
          @click="player.signIn()"
        >
          <LogIn class="size-4" />
          {{ player.signingIn ? "Waiting for Google…" : "Sign in with Google" }}
        </button>
      </template>
    </div>
  </aside>
</template>
