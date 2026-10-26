<script setup lang="ts">
/**
 * Dyno, the app's mascot: a small dinosaur with headphones.
 * - happy: default, for friendly empty states
 * - listening: bobs along with floating notes (loading, "nothing yet")
 * - sleepy: eyes closed (errors, nothing found)
 */
withDefaults(defineProps<{ mood?: "happy" | "listening" | "sleepy" }>(), { mood: "happy" });

const id = `dyno-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <svg viewBox="0 0 128 128" role="img" aria-label="Dyno" class="dyno" :class="`dyno--${mood}`">
    <defs>
      <linearGradient :id="`${id}-skin`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff5c7a" />
        <stop offset="1" stop-color="#c026d3" />
      </linearGradient>
    </defs>

    <!-- Notes float above while listening. -->
    <g v-if="mood === 'listening'" class="dyno__notes" fill="#ffb3c1">
      <g class="dyno__note">
        <circle cx="108" cy="22" r="3.5" />
        <rect x="110.5" y="8" width="2" height="14" rx="1" />
        <path d="M110.5 8 q6 2 7 7 q-3-3-7-3z" />
      </g>
      <g class="dyno__note dyno__note--late">
        <circle cx="118" cy="40" r="3" />
        <rect x="120" y="28" width="1.8" height="12" rx="0.9" />
      </g>
    </g>

    <!-- Z's while sleepy. -->
    <g v-if="mood === 'sleepy'" class="dyno__zs" fill="none" stroke="#ffb3c1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M104 14 h8 l-8 9 h8" />
      <path d="M116 4 h6 l-6 7 h6" opacity="0.6" />
    </g>

    <g class="dyno__body">
      <!-- Back spikes. -->
      <g fill="#ffb3c1">
        <path d="M58 28 L62 14 L70 24 Z" />
        <path d="M46 42 L44 29 L55 36 Z" />
        <path d="M33 60 L28 48 L41 54 Z" />
      </g>

      <!-- Tail, body, legs. -->
      <path :fill="`url(#${id}-skin)`" d="M34 84 C18 84 8 76 4 62 C14 70 24 72 36 70 Z" />
      <ellipse cx="54" cy="82" rx="30" ry="26" :fill="`url(#${id}-skin)`" />
      <rect x="38" y="96" width="13" height="18" rx="6.5" :fill="`url(#${id}-skin)`" />
      <rect x="61" y="96" width="13" height="18" rx="6.5" :fill="`url(#${id}-skin)`" />
      <ellipse cx="61" cy="88" rx="15" ry="13" fill="#ffffff" opacity="0.22" />

      <!-- Neck and head. -->
      <path :fill="`url(#${id}-skin)`" d="M44 66 C46 50 52 40 60 34 L72 52 C66 58 62 64 60 72 Z" />
      <rect x="54" y="24" width="54" height="40" rx="19" :fill="`url(#${id}-skin)`" />

      <!-- Little arm. -->
      <path d="M78 80 q9 1 11 9" fill="none" stroke="#e8389a" stroke-width="6" stroke-linecap="round" />

      <!-- Face. -->
      <template v-if="mood === 'sleepy'">
        <path d="M83 43 q5 5 10 0" fill="none" stroke="#1b1824" stroke-width="2.8" stroke-linecap="round" />
      </template>
      <template v-else>
        <circle cx="89" cy="41" r="6.5" fill="#ffffff" />
        <circle cx="91" cy="42" r="3.4" fill="#1b1824" />
        <circle cx="92.3" cy="40.6" r="1.1" fill="#ffffff" />
      </template>
      <circle cx="102" cy="35" r="1.6" fill="#1b1824" opacity="0.7" />
      <circle cx="82" cy="54" r="4.2" fill="#ffd1dc" opacity="0.65" />
      <path d="M92 55 q6 5 12 -1" fill="none" stroke="#1b1824" stroke-width="2.6" stroke-linecap="round" />

      <!-- Headphones. -->
      <path d="M64 42 C62 16 98 10 104 30" fill="none" stroke="#1b1824" stroke-width="5.5" stroke-linecap="round" />
      <rect x="60" y="34" width="14" height="20" rx="6" fill="#1b1824" />
      <rect x="63" y="38" width="8" height="12" rx="3.5" fill="#ff5c7a" />
    </g>
  </svg>
</template>

<style scoped>
.dyno {
  overflow: visible;
}

.dyno--listening .dyno__body {
  transform-origin: 54px 110px;
  animation: dyno-bob 1.2s ease-in-out infinite;
}

.dyno__note {
  animation: dyno-float 2.4s ease-in-out infinite;
}

.dyno__note--late {
  animation-delay: 1.2s;
}

.dyno--sleepy .dyno__zs {
  animation: dyno-float 3s ease-in-out infinite;
}

@keyframes dyno-bob {
  0%,
  100% {
    transform: rotate(-2deg) translateY(0);
  }
  50% {
    transform: rotate(2deg) translateY(-2px);
  }
}

@keyframes dyno-float {
  0%,
  100% {
    transform: translateY(0);
    opacity: 1;
  }
  50% {
    transform: translateY(-5px);
    opacity: 0.6;
  }
}
</style>
