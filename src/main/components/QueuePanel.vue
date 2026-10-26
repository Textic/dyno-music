<script setup lang="ts">
import { GripVertical, Music, X } from "lucide-vue-next";
import { nextTick, ref, watch } from "vue";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";

const player = usePlayerStore();
const ui = useUiStore();
const list = ref<HTMLElement | null>(null);

/** Index being dragged and where it would land. */
const dragFrom = ref<number | null>(null);
const dragOver = ref<number | null>(null);

function onDrop(to: number): void {
  const from = dragFrom.value;
  dragFrom.value = dragOver.value = null;
  if (from === null || from === to) return;
  void player.queueMove(from, to);
}

// Bring the current track into view when the panel opens.
watch(
  () => ui.queueOpen,
  async (open) => {
    if (!open) return;
    await nextTick();
    list.value?.querySelector("[data-current='true']")?.scrollIntoView({ block: "center" });
  },
);
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    leave-active-class="transition duration-200 ease-in"
    enter-from-class="translate-x-8 opacity-0"
    leave-to-class="translate-x-8 opacity-0"
  >
    <aside
      v-if="ui.queueOpen"
      class="absolute top-3 right-3 bottom-28 z-20 flex w-80 flex-col rounded-3xl border border-white/10 bg-black/45 shadow-2xl shadow-black/50 backdrop-blur-2xl"
      aria-label="Queue"
    >
      <header class="flex items-center gap-2 px-5 pt-4 pb-2">
        <h2 class="mr-auto text-base font-bold">Up next</h2>
        <span class="text-xs text-ink-faint">{{ player.queue.length }} tracks</span>
        <button class="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label="Close queue" @click="ui.queueOpen = false">
          <X class="size-4" />
        </button>
      </header>

      <p v-if="!player.queue.length" class="px-5 py-6 text-sm text-ink-faint">
        The queue is empty. Play something and what comes next shows up here.
      </p>

      <ol ref="list" class="flex-1 overflow-y-auto px-2 pb-3">
        <li
          v-for="entry in player.queue"
          :key="`${entry.index}-${entry.videoId}`"
          :data-current="entry.selected"
          draggable="true"
          class="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.07]"
          :class="[entry.selected && 'bg-white/10', dragOver === entry.index && 'ring-1 ring-accent/60']"
          @dblclick="player.queuePlay(entry.index)"
          @dragstart="dragFrom = entry.index"
          @dragover.prevent="dragOver = entry.index"
          @dragleave="dragOver = null"
          @drop.prevent="onDrop(entry.index)"
          @dragend="dragFrom = dragOver = null"
        >
          <GripVertical class="size-4 shrink-0 cursor-grab text-ink-faint opacity-0 group-hover:opacity-100" />
          <button
            class="relative size-10 shrink-0 overflow-hidden rounded-lg bg-white/5"
            :aria-label="`Play ${entry.title}`"
            @click="player.queuePlay(entry.index)"
          >
            <img v-if="entry.thumbnail" :src="entry.thumbnail" alt="" loading="lazy" class="size-full object-cover" />
            <Music v-else class="absolute inset-0 m-auto size-4 text-ink-faint" />
          </button>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium" :class="entry.selected && 'text-accent-soft'">{{ entry.title }}</p>
            <p class="truncate text-xs text-ink-faint">{{ entry.artists }}</p>
          </div>
          <span class="text-[11px] text-ink-faint tabular-nums group-hover:hidden">{{ entry.duration }}</span>
          <button
            v-if="!entry.selected"
            class="hidden size-7 place-items-center rounded-full text-ink-faint hover:bg-white/10 hover:text-ink group-hover:grid"
            :aria-label="`Remove ${entry.title} from the queue`"
            @click="player.queueRemove(entry.index)"
          >
            <X class="size-3.5" />
          </button>
        </li>
      </ol>
    </aside>
  </Transition>
</template>
