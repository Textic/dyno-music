<script setup lang="ts">
import { Music } from "lucide-vue-next";
import { onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{ src?: string; lazy?: boolean }>();

const RETRY_AFTER_MS = 1500;

/** Fills its container; retries a failed load once, then shows a placeholder. */
const current = ref(props.src);
const failed = ref(false);
let retried = false;
let timer = 0;

watch(
  () => props.src,
  (src) => {
    clearTimeout(timer);
    current.value = src;
    failed.value = false;
    retried = false;
  },
);

function onError(): void {
  if (retried || !props.src) {
    failed.value = true;
    return;
  }
  // Loads get cut off when the app reloads or the network blips; one retry covers that.
  retried = true;
  current.value = undefined;
  timer = window.setTimeout(() => (current.value = props.src), RETRY_AFTER_MS);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="relative size-full">
    <img
      v-if="current && !failed"
      :src="current"
      alt=""
      :loading="lazy ? 'lazy' : undefined"
      class="size-full object-cover"
      @error="onError"
    />
    <Music v-if="!src || failed" class="absolute inset-0 m-auto size-1/2 max-h-8 max-w-8 text-ink-faint" aria-hidden="true" />
  </div>
</template>
