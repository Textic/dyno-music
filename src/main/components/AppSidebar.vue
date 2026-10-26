<script setup lang="ts">
import { History, House, Library, LogIn, Search, Settings } from "lucide-vue-next";
import CoverImage from "@/main/components/CoverImage.vue";
import { browseRoute } from "@/main/composables/useMedia";
import { useLibraryStore } from "@/main/stores/library";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();
const library = useLibraryStore();

const links = [
  { to: { name: "home" }, label: "Home", icon: House },
  { to: { name: "search" }, label: "Search", icon: Search },
  { to: { name: "library" }, label: "Library", icon: Library },
  { to: { name: "history" }, label: "History", icon: History },
];
</script>

<template>
  <!-- Icons only on narrow windows, labels from lg up. -->
  <aside class="flex min-h-0 w-[76px] shrink-0 flex-col gap-6 px-3 pt-2 pb-5 lg:w-60 lg:px-4">
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
    </nav>

    <section v-if="player.signedIn" class="hidden min-h-0 flex-1 flex-col lg:flex" aria-label="Your playlists">
      <h2 class="px-3 pb-2 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">Playlists</h2>
      <ul class="min-h-0 flex-1 overflow-y-auto">
        <li v-if="library.loading && !library.playlists.length" class="px-3 py-2 text-xs text-ink-faint">Loading…</li>
        <li v-for="playlist in library.playlists" :key="playlist.browseId">
          <RouterLink
            :to="browseRoute(playlist.browseId!)"
            class="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/5"
            active-class="!bg-white/10"
          >
            <span class="size-9 shrink-0 overflow-hidden rounded-lg bg-white/5">
              <CoverImage :src="playlist.thumbnail" lazy />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm">{{ playlist.title }}</span>
              <span class="block truncate text-[11px] text-ink-faint">{{ playlist.subtitle }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <RouterLink
      :to="{ name: 'settings' }"
      title="Settings"
      class="mt-auto flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-white/5 hover:text-ink lg:justify-start"
      active-class="!bg-white/10 !text-ink"
    >
      <Settings class="size-[18px] shrink-0" />
      <span class="hidden lg:inline">Settings</span>
    </RouterLink>

    <!-- Narrow: just the session state. -->
    <div class="flex justify-center lg:hidden">
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

    <div v-if="!player.signedIn" class="glass hidden rounded-2xl p-4 lg:block">
      <template v-if="!player.session">
        <p class="text-sm text-ink-soft">Connecting to YouTube Music…</p>
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
