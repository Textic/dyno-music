<script setup lang="ts">
import { Play } from "lucide-vue-next";
import { computed } from "vue";
import CoverImage from "@/main/components/CoverImage.vue";
import { useOpenItem } from "@/main/composables/useMedia";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import type { MediaItem } from "@/shared/innertube/model";

const props = defineProps<{ item: MediaItem }>();

const player = usePlayerStore();
const ui = useUiStore();
const open = useOpenItem();

const round = computed(() => props.item.kind === "artist" || props.item.kind === "profile");
const playable = computed(() => Boolean(props.item.videoId || props.item.playlistId));
const isCurrent = computed(() => Boolean(props.item.videoId) && player.track?.videoId === props.item.videoId);
</script>

<template>
  <div class="group flex w-full min-w-0 flex-col gap-2.5" @contextmenu="ui.openMenu($event, item)">
    <button
      class="relative aspect-square w-full overflow-hidden bg-white/5 shadow-lg shadow-shade/30 transition group-hover:shadow-shade/60"
      :class="round ? 'rounded-full' : 'rounded-2xl'"
      :aria-label="`Open ${item.title}`"
      @click="open(item)"
    >
      <CoverImage :src="item.thumbnail" lazy class="transition duration-500 group-hover:scale-105" />
      <span
        v-if="playable"
        class="absolute right-2.5 bottom-2.5 grid size-11 translate-y-2 place-items-center rounded-full bg-accent text-ink opacity-0 shadow-xl shadow-shade/50 transition group-hover:translate-y-0 group-hover:opacity-100 hover:scale-105"
        role="button"
        :aria-label="`Play ${item.title}`"
        @click.stop="player.play(item)"
      >
        <Play class="size-5 translate-x-px" fill="currentColor" />
      </span>
    </button>
    <div class="min-w-0 px-0.5" :class="round && 'text-center'">
      <p class="truncate text-sm font-semibold" :class="isCurrent && 'text-accent-soft'" :title="item.title">
        {{ item.title }}
      </p>
      <p class="line-clamp-2 text-xs text-ink-faint" :title="item.subtitle">{{ item.subtitle }}</p>
    </div>
  </div>
</template>
