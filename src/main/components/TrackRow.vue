<script setup lang="ts">
import { Music, Play } from "lucide-vue-next";
import type { SearchItem } from "@/shared/innertube/parsers";

defineProps<{ item: SearchItem; current: boolean }>();
defineEmits<{ play: [] }>();
</script>

<template>
  <li
    class="group flex items-center gap-4 rounded-2xl px-3 py-2 transition hover:bg-white/[0.07]"
    :class="current && 'bg-white/[0.07]'"
    @dblclick="$emit('play')"
  >
    <button
      class="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white/5"
      :aria-label="`Play ${item.title}`"
      @click="$emit('play')"
    >
      <img v-if="item.thumbnail" :src="item.thumbnail" alt="" loading="lazy" class="size-full object-cover" />
      <Music v-else class="absolute inset-0 m-auto size-5 text-ink-faint" />
      <span
        class="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100"
      >
        <Play class="size-5" fill="currentColor" />
      </span>
    </button>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium" :class="current && 'text-accent-soft'">{{ item.title }}</p>
      <p class="truncate text-xs text-ink-faint">{{ item.subtitle }}</p>
    </div>
  </li>
</template>
