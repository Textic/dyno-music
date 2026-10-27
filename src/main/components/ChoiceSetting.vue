<script setup lang="ts" generic="T extends string">
defineProps<{ label: string; description?: string; options: { value: T; label: string }[] }>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="flex items-center gap-4 py-3">
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-medium">{{ label }}</span>
      <span v-if="description" class="mt-0.5 block text-xs text-ink-faint">{{ description }}</span>
    </span>
    <div class="flex shrink-0 rounded-xl bg-white/5 p-1" role="radiogroup" :aria-label="label">
      <button
        v-for="option in options"
        :key="option.value"
        class="rounded-lg px-3 py-1.5 text-xs font-medium transition"
        :class="model === option.value ? 'bg-white/15 text-ink shadow-sm' : 'text-ink-faint hover:text-ink'"
        role="radio"
        :aria-checked="model === option.value"
        @click="model = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
