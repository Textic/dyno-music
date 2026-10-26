<script setup lang="ts">
import AmbientBackground from "./components/AmbientBackground.vue";
import AppSidebar from "./components/AppSidebar.vue";
import PlayerIsland from "./components/PlayerIsland.vue";
import SearchBar from "./components/SearchBar.vue";
</script>

<template>
  <div class="relative isolate flex h-full">
    <AmbientBackground />
    <AppSidebar />

    <div class="relative flex min-w-0 flex-1 flex-col">
      <header class="px-8 pt-5 pb-3">
        <SearchBar />
      </header>
      <main class="min-h-0 flex-1 overflow-y-auto px-8 pt-2 pb-40">
        <RouterView />
      </main>
      <PlayerIsland />
    </div>
  </div>
</template>
