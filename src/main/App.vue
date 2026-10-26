<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import AddToPlaylistDialog from "./components/AddToPlaylistDialog.vue";
import AmbientBackground from "./components/AmbientBackground.vue";
import AppSidebar from "./components/AppSidebar.vue";
import ContextMenu from "./components/ContextMenu.vue";
import NowPlaying from "./components/NowPlaying.vue";
import PlayerIsland from "./components/PlayerIsland.vue";
import QueuePanel from "./components/QueuePanel.vue";
import TitleBar from "./components/TitleBar.vue";
import ToastHost from "./components/ToastHost.vue";
import { useUiStore } from "./stores/ui";

const route = useRoute();
const ui = useUiStore();
const scroller = ref<HTMLElement | null>(null);

// The page scrolls inside <main>, not the window, so the router can't reset it by itself.
watch(
  () => route.fullPath,
  () => {
    scroller.value?.scrollTo({ top: 0 });
    ui.nowPlayingOpen = false;
  },
);
</script>

<template>
  <div class="relative isolate flex h-full flex-col">
    <AmbientBackground />
    <TitleBar />

    <div class="relative flex min-h-0 flex-1">
      <AppSidebar />

      <div class="relative flex min-w-0 flex-1 flex-col">
        <main ref="scroller" class="min-h-0 flex-1 overflow-y-auto px-8 pt-4 pb-40">
          <RouterView :key="route.fullPath" />
        </main>
        <QueuePanel />
        <PlayerIsland v-show="!ui.nowPlayingOpen" />
      </div>

      <NowPlaying />
    </div>

    <ContextMenu />
    <AddToPlaylistDialog />
    <ToastHost />
  </div>
</template>
