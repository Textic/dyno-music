<script setup lang="ts">
/** The app mark: Dyno's silhouette (same shapes as DynoMascot) in white on the brand gradient. */
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
    <g transform="translate(3 4) scale(0.45)">
      <g fill="#ffffff">
        <path d="M58 28 L62 14 L70 24 Z" />
        <path d="M46 42 L44 29 L55 36 Z" />
        <path d="M33 60 L28 48 L41 54 Z" />
        <path d="M34 84 C18 84 8 76 4 62 C14 70 24 72 36 70 Z" />
        <ellipse cx="54" cy="82" rx="30" ry="26" />
        <rect x="38" y="96" width="13" height="18" rx="6.5" />
        <rect x="61" y="96" width="13" height="18" rx="6.5" />
        <path d="M44 66 C46 50 52 40 60 34 L72 52 C66 58 62 64 60 72 Z" />
        <rect x="54" y="24" width="54" height="40" rx="19" />
      </g>
      <circle cx="90" cy="41" r="6" fill="#b4237c" />
      <path d="M92 55 q6 5 12 -1" fill="none" stroke="#b4237c" stroke-width="4" stroke-linecap="round" />
      <path d="M64 42 C62 16 98 10 104 30" fill="none" stroke="#1b1824" stroke-width="7" stroke-linecap="round" />
      <rect x="60" y="34" width="14" height="20" rx="6" fill="#1b1824" />
    </g>
  </svg>
</template>
