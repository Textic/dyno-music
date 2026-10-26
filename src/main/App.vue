<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import AddToPlaylistDialog from "./components/AddToPlaylistDialog.vue";
import AmbientBackground from "./components/AmbientBackground.vue";
import AppSidebar from "./components/AppSidebar.vue";
import ContextMenu from "./components/ContextMenu.vue";
import PlayerIsland from "./components/PlayerIsland.vue";
import QueuePanel from "./components/QueuePanel.vue";
import SearchBar from "./components/SearchBar.vue";
import ToastHost from "./components/ToastHost.vue";

const route = useRoute();
const scroller = ref<HTMLElement | null>(null);

// The page scrolls inside <main>, not the window, so the router can't reset it by itself.
watch(
  () => route.fullPath,
  () => scroller.value?.scrollTo({ top: 0 }),
);
</script>

<template>
  <div class="relative isolate flex h-full">
    <AmbientBackground />
    <AppSidebar />

    <div class="relative flex min-w-0 flex-1 flex-col">
      <header class="px-8 pt-5 pb-3">
        <SearchBar />
      </header>
      <main ref="scroller" class="min-h-0 flex-1 overflow-y-auto px-8 pt-2 pb-40">
        <RouterView :key="route.fullPath" />
      </main>
      <QueuePanel />
      <PlayerIsland />
    </div>

    <ContextMenu />
    <AddToPlaylistDialog />
    <ToastHost />
  </div>
</template>
