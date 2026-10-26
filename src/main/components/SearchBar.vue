<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useOpenItem } from "@/main/composables/useMedia";
import { suggestions as fetchSuggestions } from "@/main/services/music";
import type { MediaItem, SearchSuggestions } from "@/shared/innertube/model";

const route = useRoute();
const router = useRouter();
const open = useOpenItem();
const input = ref<HTMLInputElement | null>(null);
const query = ref("");
const focused = ref(false);
const suggestions = ref<SearchSuggestions>({ queries: [], items: [] });
/** Keyboard selection across queries then items. */
const active = ref(-1);

const entries = computed(() => [
  ...suggestions.value.queries.map((q) => ({ kind: "query" as const, query: q })),
  ...suggestions.value.items.slice(0, 4).map((item) => ({ kind: "item" as const, item })),
]);
const showSuggestions = computed(() => focused.value && query.value.trim().length > 0 && entries.value.length > 0);

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === "string") query.value = q;
  },
  { immediate: true },
);

let timer = 0;
let latest = 0;
watch(query, (value) => {
  active.value = -1;
  clearTimeout(timer);
  const input = value.trim();
  if (!input) return void (suggestions.value = { queries: [], items: [] });
  timer = window.setTimeout(async () => {
    const id = ++latest;
    try {
      const result = await fetchSuggestions(input);
      if (id === latest) suggestions.value = result;
    } catch {
      // Suggestions are optional; searching still works.
    }
  }, 180);
});

function submit(text = query.value): void {
  const q = text.trim();
  if (!q) return;
  query.value = q;
  focused.value = false;
  input.value?.blur();
  void router.push({ name: "search", query: { q } });
}

function pickItem(item: MediaItem): void {
  focused.value = false;
  input.value?.blur();
  open(item);
}

function onInputKeydown(event: KeyboardEvent): void {
  if (!showSuggestions.value) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    // -1 is the text box itself; wrap around past either end.
    const last = entries.value.length - 1;
    if (event.key === "ArrowDown") active.value = active.value >= last ? -1 : active.value + 1;
    else active.value = active.value <= -1 ? last : active.value - 1;
  } else if (event.key === "Enter" && active.value >= 0) {
    event.preventDefault();
    const entry = entries.value[active.value];
    if (entry.kind === "query") submit(entry.query);
    else pickItem(entry.item);
  } else if (event.key === "Escape") {
    focused.value = false;
  }
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    input.value?.focus();
    input.value?.select();
  }
}

onMounted(() => window.addEventListener("keydown", onGlobalKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <form class="relative z-40 mx-auto max-w-xl" role="search" @submit.prevent="submit()">
    <Search class="pointer-events-none absolute top-[22px] left-4 size-[18px] -translate-y-1/2 text-ink-faint" />
    <input
      ref="input"
      v-model="query"
      type="search"
      placeholder="Search songs, artists, albums…"
      autocomplete="off"
      role="combobox"
      :aria-expanded="showSuggestions"
      aria-controls="search-suggestions"
      class="glass w-full rounded-2xl py-3 pr-20 pl-11 text-sm outline-none transition placeholder:text-ink-faint focus:border-white/20 focus:bg-white/10"
      @focus="focused = true"
      @blur="focused = false"
      @keydown="onInputKeydown"
    />
    <kbd
      class="pointer-events-none absolute top-[22px] right-3 -translate-y-1/2 rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-ink-faint"
    >
      Ctrl K
    </kbd>

    <ul
      v-if="showSuggestions"
      id="search-suggestions"
      role="listbox"
      class="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#16151c]/95 p-1.5 shadow-2xl shadow-black/60"
      @mousedown.prevent
    >
      <li v-for="(entry, i) in entries" :key="i" role="option" :aria-selected="i === active">
        <button
          v-if="entry.kind === 'query'"
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10"
          :class="i === active && 'bg-white/10'"
          @click="submit(entry.query)"
        >
          <Search class="size-4 text-ink-faint" />
          {{ entry.query }}
        </button>
        <button
          v-else
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition hover:bg-white/10"
          :class="i === active && 'bg-white/10'"
          @click="pickItem(entry.item)"
        >
          <img
            v-if="entry.item.thumbnail"
            :src="entry.item.thumbnail"
            alt=""
            class="size-9 object-cover"
            :class="entry.item.kind === 'artist' ? 'rounded-full' : 'rounded-md'"
          />
          <span class="min-w-0">
            <span class="block truncate text-sm">{{ entry.item.title }}</span>
            <span class="block truncate text-xs text-ink-faint">{{ entry.item.subtitle }}</span>
          </span>
        </button>
      </li>
    </ul>
  </form>
</template>
