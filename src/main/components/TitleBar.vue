<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";
import DynoLogo from "@/main/components/brand/DynoLogo.vue";
import SearchBar from "@/main/components/SearchBar.vue";

// Null in a plain browser (previewing the UI without Tauri).
const appWindow = isTauri() ? getCurrentWindow() : null;
const maximized = ref(false);
let unlisten: (() => void) | undefined;

async function refreshMaximized(): Promise<void> {
  if (appWindow) maximized.value = await appWindow.isMaximized();
}

onMounted(async () => {
  await refreshMaximized();
  unlisten = await appWindow?.onResized(() => void refreshMaximized());
});
onBeforeUnmount(() => unlisten?.());

const windowButton = "grid h-full w-12 place-items-center text-ink-soft transition hover:bg-white/10 hover:text-ink";
</script>

<template>
  <!-- data-tauri-drag-region drags the window (double-click maximizes); it applies to the element
       that carries it, so each empty area that should drag needs it. -->
  <header class="relative z-40 flex h-14 shrink-0 items-center" data-tauri-drag-region>
    <div class="flex w-[76px] shrink-0 items-center justify-center gap-2.5 lg:w-60 lg:justify-start lg:px-6" data-tauri-drag-region>
      <DynoLogo class="pointer-events-none size-8 shrink-0 drop-shadow-[0_6px_14px_rgba(255,77,109,0.35)]" />
      <span class="pointer-events-none hidden text-lg font-extrabold tracking-tight lg:inline">dyno</span>
    </div>

    <div class="min-w-0 flex-1 px-6" data-tauri-drag-region>
      <SearchBar />
    </div>

    <div class="flex h-full items-stretch self-start">
      <button :class="[windowButton, 'h-9']" aria-label="Minimize" @click="appWindow?.minimize()">
        <Minus class="size-4" />
      </button>
      <button
        :class="[windowButton, 'h-9']"
        :aria-label="maximized ? 'Restore' : 'Maximize'"
        @click="appWindow?.toggleMaximize()"
      >
        <Copy v-if="maximized" class="size-3.5 -scale-x-100" />
        <Square v-else class="size-3.5" />
      </button>
      <button
        :class="[windowButton, 'h-9 hover:!bg-rose-600 hover:!text-white']"
        aria-label="Close"
        @click="appWindow?.close()"
      >
        <X class="size-4" />
      </button>
    </div>
  </header>
</template>
