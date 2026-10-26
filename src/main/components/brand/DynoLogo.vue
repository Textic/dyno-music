<script setup lang="ts">
/** The app mark: a solid "D" with a play button cut out, on the brand gradient. */
const id = `logo-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <svg viewBox="0 0 64 64" role="img" aria-label="Dyno Music">
    <defs>
      <linearGradient :id="`${id}-bg`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff5c7a" />
        <stop offset="1" stop-color="#c026d3" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" :fill="`url(#${id}-bg)`" />
    <path d="M15 12 H31 C44 12 52 21 52 32 C52 43 44 52 31 52 H15 Z" fill="#ffffff" />
    <path d="M27 23 L41 32 L27 41 Z" fill="#d02c9a" stroke="#d02c9a" stroke-width="3" stroke-linejoin="round" />
  </svg>
</template>
