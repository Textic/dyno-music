<script setup lang="ts">
import { ThumbsDown, ThumbsUp } from "lucide-vue-next";
import { computed } from "vue";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();

const liked = computed(() => player.state.likeStatus === "LIKE");
const disliked = computed(() => player.state.likeStatus === "DISLIKE");
const button =
  "grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink";
</script>

<template>
  <div class="flex items-center">
    <button
      :class="button"
      :aria-label="disliked ? 'Remove dislike' : 'Dislike'"
      :aria-pressed="disliked"
      @click="player.like(disliked ? 'INDIFFERENT' : 'DISLIKE')"
    >
      <ThumbsDown class="size-4" :fill="disliked ? 'currentColor' : 'none'" />
    </button>
    <button
      :class="[button, liked && '!text-accent-soft']"
      :aria-label="liked ? 'Remove like' : 'Like'"
      :aria-pressed="liked"
      @click="player.like(liked ? 'INDIFFERENT' : 'LIKE')"
    >
      <ThumbsUp class="size-4" :fill="liked ? 'currentColor' : 'none'" />
    </button>
  </div>
</template>
