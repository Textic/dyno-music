<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const input = ref<HTMLInputElement | null>(null);
const query = ref("");

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === "string") query.value = q;
  },
  { immediate: true },
);

function submit(): void {
  const q = query.value.trim();
  if (q) void router.push({ name: "search", query: { q } });
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    input.value?.focus();
    input.value?.select();
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <form class="relative mx-auto max-w-xl" role="search" @submit.prevent="submit">
    <Search class="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-faint" />
    <input
      ref="input"
      v-model="query"
      type="search"
      placeholder="Search songs, artists, albums…"
      autocomplete="off"
      class="glass w-full rounded-2xl py-3 pr-20 pl-11 text-sm outline-none transition placeholder:text-ink-faint focus:border-white/20 focus:bg-white/10"
    />
    <kbd
      class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-ink-faint"
    >
      Ctrl K
    </kbd>
  </form>
</template>
