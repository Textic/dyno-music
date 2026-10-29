<script setup lang="ts">
defineProps<{ label: string; description?: string; disabled?: boolean }>();
const model = defineModel<boolean>({ required: true });
</script>

<template>
  <!-- relative: the hidden checkbox stays inside the label. Without it, it was placed outside
       the scrolling page, and focusing it on click scrolled the whole window up. -->
  <label class="relative flex cursor-pointer items-center gap-4 py-3" :class="disabled && 'cursor-default opacity-50'">
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-medium">{{ label }}</span>
      <span v-if="description" class="mt-0.5 block text-xs text-ink-faint">{{ description }}</span>
    </span>
    <input v-model="model" type="checkbox" role="switch" class="peer sr-only" :disabled="disabled" />
    <span
      class="relative h-6 w-11 shrink-0 rounded-full bg-white/15 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent-soft after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-[#fff] after:shadow after:transition peer-checked:after:translate-x-5"
      aria-hidden="true"
    />
  </label>
</template>
