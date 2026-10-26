<script setup lang="ts">
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-vue-next";
import { computed } from "vue";
import { usePlayerStore } from "@/main/stores/player";

const props = withDefaults(defineProps<{ large?: boolean }>(), { large: false });

const player = usePlayerStore();

const repeatLabel = computed(
  () => ({ NONE: "Repeat: off", ALL: "Repeat: all", ONE: "Repeat: one" })[player.state.repeat],
);
const button = computed(
  () =>
    `grid place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink disabled:opacity-40 ${props.large ? "size-12" : "size-9"}`,
);
const icon = computed(() => (props.large ? "size-5" : "size-4"));
const skipIcon = computed(() => (props.large ? "size-6" : "size-[18px]"));
</script>

<template>
  <div class="flex items-center" :class="large ? 'gap-4' : 'gap-2'">
    <button
      :class="[button, player.state.shuffle && '!text-accent-soft']"
      aria-label="Shuffle"
      :aria-pressed="player.state.shuffle"
      :disabled="!player.track"
      @click="player.shuffle()"
    >
      <Shuffle :class="icon" />
    </button>
    <button :class="button" aria-label="Previous" @click="player.previous()">
      <SkipBack :class="skipIcon" fill="currentColor" />
    </button>
    <button
      class="grid place-items-center rounded-full bg-ink text-night shadow-lg transition hover:scale-105 active:scale-95"
      :class="large ? 'size-16' : 'size-11'"
      :aria-label="player.isPlaying ? 'Pause' : 'Play'"
      @click="player.toggle()"
    >
      <Pause v-if="player.isPlaying" :class="large ? 'size-7' : 'size-5'" fill="currentColor" />
      <Play v-else class="translate-x-px" :class="large ? 'size-7' : 'size-5'" fill="currentColor" />
    </button>
    <button :class="button" aria-label="Next" @click="player.next()">
      <SkipForward :class="skipIcon" fill="currentColor" />
    </button>
    <button
      :class="[button, player.state.repeat !== 'NONE' && '!text-accent-soft']"
      :aria-label="repeatLabel"
      :title="repeatLabel"
      :disabled="!player.track"
      @click="player.cycleRepeat()"
    >
      <Repeat1 v-if="player.state.repeat === 'ONE'" :class="icon" />
      <Repeat v-else :class="icon" />
    </button>
  </div>
</template>
