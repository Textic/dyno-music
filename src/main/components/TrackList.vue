<script setup lang="ts">
import { Ellipsis, Play } from "lucide-vue-next";
import ArtistLinks from "@/main/components/ArtistLinks.vue";
import CoverImage from "@/main/components/CoverImage.vue";
import { browseRoute, useOpenItem } from "@/main/composables/useMedia";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import type { MediaItem } from "@/shared/innertube/model";

const props = withDefaults(
  defineProps<{
    items: MediaItem[];
    /** Album or playlist the tracks belong to: playing one continues through the rest. */
    context?: string;
    showIndex?: boolean;
    showAlbum?: boolean;
  }>(),
  { showIndex: false, showAlbum: true },
);

const player = usePlayerStore();
const ui = useUiStore();
const open = useOpenItem();

const KIND_LABEL: Partial<Record<MediaItem["kind"], string>> = {
  album: "Album",
  artist: "Artist",
  playlist: "Playlist",
  profile: "Profile",
  podcast: "Podcast",
};

function isCurrent(item: MediaItem): boolean {
  return Boolean(item.videoId) && player.track?.videoId === item.videoId;
}

function activate(item: MediaItem): void {
  open(item, props.context);
}
</script>

<template>
  <ol class="flex flex-col">
    <li
      v-for="(item, i) in items"
      :key="`${item.videoId ?? item.browseId}-${i}`"
      class="group grid cursor-default grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3 py-1.5 transition hover:bg-white/[0.07] lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto]"
      :class="isCurrent(item) && 'bg-white/[0.07]'"
      @dblclick="activate(item)"
      @contextmenu="ui.openMenu($event, item, context)"
    >
      <div class="flex items-center gap-3">
        <span v-if="showIndex" class="w-6 text-right text-sm text-ink-faint tabular-nums group-hover:hidden">
          {{ i + 1 }}
        </span>
        <button
          class="relative size-11 shrink-0 overflow-hidden bg-white/5"
          :class="item.kind === 'artist' ? 'rounded-full' : 'rounded-lg'"
          :aria-label="item.videoId ? `Play ${item.title}` : `Open ${item.title}`"
          @click="activate(item)"
        >
          <CoverImage :src="item.thumbnail" lazy />
          <span
            v-if="item.videoId"
            class="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100"
          >
            <Play class="size-4" fill="currentColor" />
          </span>
        </button>
      </div>

      <div class="min-w-0">
        <p class="flex items-center gap-1.5 text-sm font-medium" :class="isCurrent(item) && 'text-accent-soft'">
          <span class="truncate">{{ item.title }}</span>
          <span
            v-if="item.explicit"
            class="shrink-0 rounded-sm bg-white/15 px-1 text-[9px] leading-4 font-bold text-ink-soft"
            title="Explicit"
          >
            E
          </span>
        </p>
        <p class="truncate text-xs text-ink-faint">
          <template v-if="!item.videoId && KIND_LABEL[item.kind]">{{ KIND_LABEL[item.kind] }} • </template>
          <ArtistLinks v-if="item.artists.length" :artists="item.artists" />
          <template v-else>{{ item.subtitle }}</template>
        </p>
      </div>

      <p class="hidden min-w-0 truncate text-xs text-ink-faint lg:block">
        <RouterLink
          v-if="showAlbum && item.album?.browseId"
          :to="browseRoute(item.album.browseId)"
          class="hover:text-ink hover:underline"
        >
          {{ item.album.name }}
        </RouterLink>
      </p>

      <div class="flex items-center gap-2">
        <span class="w-10 text-right text-xs text-ink-faint tabular-nums">{{ item.duration }}</span>
        <button
          class="grid size-8 place-items-center rounded-full text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-ink focus-visible:opacity-100"
          aria-label="More options"
          @click.stop="ui.openMenu($event, item, context)"
        >
          <Ellipsis class="size-4" />
        </button>
      </div>
    </li>
  </ol>
</template>
