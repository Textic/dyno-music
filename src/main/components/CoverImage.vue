<script lang="ts">
/** Each failed cover is logged once per launch, wherever it shows, so it can be traced. */
const logged = new Set<string>();
</script>

<script setup lang="ts">
import { Music } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { uiLog } from "@/shared/api";

const props = defineProps<{ src?: string; lazy?: boolean }>();

/** Waits before each new attempt: loads get cut off when the network blips, or Google says 429. */
const RETRY_AFTER_MS = [1500, 5000];

/**
 * The URLs to try in order. A Google artwork asked for at an unusual size sometimes fails while
 * the 544 px one (what the player uses, so likely already cached) loads fine.
 */
const candidates = computed(() => {
  const src = props.src;
  if (!src) return [];
  const standard = /googleusercontent\.com|ggpht\.com/.test(src)
    ? src.replace(/=(w\d+-h\d+|s\d+)[^/]*$/, "=w544-h544-l90-rj")
    : src;
  return standard === src ? [src] : [src, standard];
});

/** Fills its container; retries failed loads, then shows a placeholder. */
const current = ref<string | undefined>(props.src);
const failed = ref(false);
let attempt = 0;
let timer = 0;

watch(
  () => props.src,
  () => {
    clearTimeout(timer);
    attempt = 0;
    current.value = candidates.value[0];
    failed.value = false;
  },
);

function onError(): void {
  const urls = candidates.value;
  const delays = RETRY_AFTER_MS;
  // Every URL gets each retry: [src, standard, src, standard, …].
  attempt += 1;
  if (!urls.length || attempt >= urls.length * (delays.length + 1)) {
    failed.value = true;
    if (props.src && !logged.has(props.src)) {
      logged.add(props.src);
      uiLog("warn", `Cover image failed to load: ${props.src}`).catch(() => {});
    }
    return;
  }
  const next = urls[attempt % urls.length];
  const round = Math.floor(attempt / urls.length);
  current.value = undefined;
  // A different URL can go at once; the same one again waits a little.
  const wait = round === 0 ? 0 : delays[round - 1];
  timer = window.setTimeout(() => (current.value = next), wait);
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
