<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();
const artwork = computed(() => player.track?.thumbnail ?? "");
</script>

<template>
  <!-- One blurred layer behind everything: the whole "glass" look comes from this. -->
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night" aria-hidden="true">
    <div class="absolute -top-1/3 -left-1/4 h-[80vh] w-[70vw] rounded-full bg-fuchsia-600/20 blur-[140px]" />
    <div class="absolute -right-1/4 -bottom-1/3 h-[80vh] w-[70vw] rounded-full bg-indigo-600/20 blur-[140px]" />

    <!-- The new artwork fades in on top of the old one, which stays as it is until covered. The
         images are opaque and the layer holds the transparency: translucent images would show
         the old one through the new, then darken when it was removed. -->
    <div class="absolute inset-0 opacity-55">
      <Transition
        enter-active-class="z-[1] transition-opacity duration-[1600ms] ease-out"
        leave-active-class="transition-opacity duration-[1600ms] ease-in"
        enter-from-class="opacity-0"
        :leave-to-class="artwork ? '' : 'opacity-0'"
      >
        <img
          v-if="artwork"
          :key="artwork"
          :src="artwork"
          alt=""
          class="absolute inset-0 h-full w-full scale-125 object-cover blur-[90px] saturate-150"
        />
      </Transition>
    </div>

    <div class="absolute inset-0 bg-gradient-to-b from-black/25 via-black/50 to-black/80" />
  </div>
</template>
