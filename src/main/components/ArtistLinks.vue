<script setup lang="ts">
import { browseRoute } from "@/main/composables/useMedia";
import type { Link } from "@/shared/innertube/model";

defineProps<{ artists: Link[] }>();
</script>

<template>
  <span>
    <template v-for="(artist, i) in artists" :key="`${artist.name}-${i}`">
      <span v-if="i > 0">, </span>
      <RouterLink
        v-if="artist.browseId"
        :to="browseRoute(artist.browseId)"
        class="hover:text-ink hover:underline"
        @click.stop
      >
        {{ artist.name }}
      </RouterLink>
      <span v-else>{{ artist.name }}</span>
    </template>
  </span>
</template>
