<script setup lang="ts">
import { useUiStore } from "@/main/stores/ui";

const ui = useUiStore();
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed top-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      <TransitionGroup
        enter-active-class="transition duration-200"
        leave-active-class="transition duration-200"
        enter-from-class="-translate-y-2 opacity-0"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <p
          v-for="toast in ui.toasts"
          :key="toast.id"
          class="rounded-full border border-white/10 bg-surface/95 px-4 py-2 text-sm shadow-xl shadow-shade/50"
          :class="toast.kind === 'error' && 'text-rose-300'"
        >
          {{ toast.message }}
        </p>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
