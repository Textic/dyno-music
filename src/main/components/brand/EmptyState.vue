<script setup lang="ts">
import DynoMascot from "@/main/components/brand/DynoMascot.vue";

withDefaults(
  defineProps<{
    title: string;
    message?: string;
    mood?: "happy" | "listening" | "sleepy";
    size?: "sm" | "md";
  }>(),
  { mood: "happy", size: "md" },
);
</script>

<template>
  <div class="flex flex-col items-center text-center" :class="size === 'sm' ? 'gap-2 py-6' : 'gap-3 py-12'">
    <DynoMascot :mood="mood" :class="size === 'sm' ? 'size-20' : 'size-32'" />
    <p class="font-semibold" :class="size === 'sm' ? 'text-sm' : 'text-lg'">{{ title }}</p>
    <p v-if="message" class="max-w-sm text-sm text-ink-faint">{{ message }}</p>
    <div v-if="$slots.default" class="mt-2 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
