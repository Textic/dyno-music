<script lang="ts">
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

/** Each failed cover is logged once per launch, wherever it shows, so it can be traced. */
const logged = new Set<string>();

/**
 * The same artwork fetched by Dyno Music's Rust side (cover.rs). Google sometimes refuses
 * artwork to the WebView while it serves the same URL anywhere else.
 */
function throughApp(src: string): string | null {
  if (!isTauri() || !/googleusercontent\.com|ggpht\.com|ytimg\.com/.test(src)) return null;
  return `${convertFileSrc("", "cover")}?u=${encodeURIComponent(src)}`;
}
</script>

<script setup lang="ts">
import { Music } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { uiLog } from "@/shared/api";

const props = defineProps<{ src?: string; lazy?: boolean }>();

/** The last way in gets one more try after this long: a network blip shouldn't cost the cover. */
const RETRY_AFTER_MS = 1500;

/** The URLs to try in order: the artwork itself, then the same one fetched by the app. */
const candidates = computed(() => {
  const src = props.src;
  if (!src) return [];
  const viaApp = throughApp(src);
  return viaApp ? [src, viaApp] : [src];
});

/** Fills its container; falls back and retries failed loads, then shows a placeholder. */
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
  // Each URL once, then the last one again after a pause.
  attempt += 1;
  if (!urls.length || attempt > urls.length) {
    failed.value = true;
    if (props.src && !logged.has(props.src)) {
      logged.add(props.src);
      uiLog("warn", `Cover image failed to load: ${props.src}`).catch(() => {});
    }
    return;
  }
  const next = urls[Math.min(attempt, urls.length - 1)];
  current.value = undefined;
  // A different URL can go at once; the same one again waits a little.
  const wait = attempt < urls.length ? 0 : RETRY_AFTER_MS;
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
