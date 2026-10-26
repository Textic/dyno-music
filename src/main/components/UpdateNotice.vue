<script setup lang="ts">
import { Download, X } from "lucide-vue-next";
import { computed } from "vue";
import DynoLogo from "@/main/components/brand/DynoLogo.vue";
import { useUpdatesStore } from "@/main/stores/updates";

const updates = useUpdatesStore();

const visible = computed(
  () => (updates.status === "available" && !updates.dismissed) || updates.status === "downloading",
);
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    leave-active-class="transition duration-200 ease-in"
    enter-from-class="translate-y-3 opacity-0"
    leave-to-class="translate-y-3 opacity-0"
  >
    <div
      v-if="visible"
      class="absolute right-6 bottom-32 z-30 flex w-80 items-start gap-3 rounded-2xl border border-white/10 bg-[#18171f]/95 p-4 shadow-2xl shadow-black/50"
      role="status"
    >
      <DynoLogo class="size-10 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">Dyno Music {{ updates.version }} is available</p>
        <template v-if="updates.status === 'downloading'">
          <p class="mt-1 text-xs text-ink-faint">Downloading… the app restarts when it's ready.</p>
          <div class="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft transition-[width]"
              :class="updates.progress === null && 'w-1/3 animate-pulse'"
              :style="updates.progress !== null ? { width: `${Math.round(updates.progress * 100)}%` } : {}"
            />
          </div>
        </template>
        <template v-else>
          <p class="mt-1 text-xs text-ink-faint">The app restarts to finish installing, which stops the music for a moment.</p>
          <div class="mt-3 flex gap-2">
            <button
              class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold transition hover:brightness-110"
              @click="updates.install()"
            >
              <Download class="size-3.5" /> Install & restart
            </button>
            <button class="glass glass-hover rounded-lg px-3 py-1.5 text-xs" @click="updates.dismissed = true">Later</button>
          </div>
        </template>
      </div>
      <button
        v-if="updates.status !== 'downloading'"
        class="grid size-6 place-items-center rounded-full text-ink-faint hover:bg-white/10 hover:text-ink"
        aria-label="Dismiss"
        @click="updates.dismissed = true"
      >
        <X class="size-3.5" />
      </button>
    </div>
  </Transition>
</template>
