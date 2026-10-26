<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { ref } from "vue";
import MediaCard from "@/main/components/MediaCard.vue";
import TrackList from "@/main/components/TrackList.vue";
import { browseRoute } from "@/main/composables/useMedia";
import type { Shelf } from "@/shared/innertube/model";

defineProps<{ shelf: Shelf; context?: string }>();

const row = ref<HTMLElement | null>(null);

function scroll(direction: 1 | -1): void {
  const el = row.value;
  if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <div v-if="shelf.title || shelf.more" class="flex items-end gap-3">
      <h2 class="mr-auto text-xl font-bold tracking-tight">{{ shelf.title }}</h2>
      <RouterLink
        v-if="shelf.more"
        :to="browseRoute(shelf.more.browseId, shelf.more.params)"
        class="rounded-full px-3 py-1 text-xs font-semibold text-ink-soft transition hover:bg-white/10 hover:text-ink"
      >
        See all
      </RouterLink>
      <template v-if="shelf.style === 'carousel'">
        <button
          class="grid size-8 place-items-center rounded-full bg-white/5 text-ink-soft transition hover:bg-white/10 hover:text-ink"
          aria-label="Scroll left"
          @click="scroll(-1)"
        >
          <ChevronLeft class="size-4" />
        </button>
        <button
          class="grid size-8 place-items-center rounded-full bg-white/5 text-ink-soft transition hover:bg-white/10 hover:text-ink"
          aria-label="Scroll right"
          @click="scroll(1)"
        >
          <ChevronRight class="size-4" />
        </button>
      </template>
    </div>

    <TrackList v-if="shelf.style === 'list'" :items="shelf.items" :context="context" />

    <div
      v-else-if="shelf.style === 'carousel'"
      ref="row"
      class="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div v-for="(item, i) in shelf.items" :key="i" class="w-40 shrink-0 snap-start xl:w-44">
        <MediaCard :item="item" />
      </div>
    </div>

    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
      <MediaCard v-for="(item, i) in shelf.items" :key="i" :item="item" />
    </div>
  </section>
</template>
