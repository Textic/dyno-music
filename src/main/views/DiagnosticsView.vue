<script setup lang="ts">
import { Eye, EyeOff } from "lucide-vue-next";
import { computed } from "vue";
import { usePlayerStore } from "@/main/stores/player";

const player = usePlayerStore();

const rows = computed(() => {
  const d = player.diag;
  return [
    { label: "Signed in", value: player.session ? (player.session.loggedIn ? "Yes" : "No") : "—" },
    { label: "Page visibility", value: d?.visibility ?? "—" },
    { label: "Max timer gap (expected ≈1000 ms)", value: d ? `${d.maxTimerGapMs} ms` : "—" },
    { label: "Average timer gap", value: d ? `${d.avgTimerGapMs} ms` : "—" },
    {
      label: "Is playback advancing?",
      value: !d ? "—" : d.playbackAdvancing === null ? "(not playing)" : d.playbackAdvancing ? "Yes" : "No",
    },
    { label: "Playback method", value: d?.lastPlayMethod ?? "—" },
  ];
});

const levelClass = { info: "text-ink-soft", warn: "text-amber-300", error: "text-rose-400" } as const;
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-3xl font-extrabold tracking-tight">Diagnostics</h1>
      <button class="glass glass-hover inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm" @click="player.showPlayer()">
        <Eye class="size-4" /> Show YouTube Music
      </button>
      <button class="glass glass-hover inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm" @click="player.hidePlayer()">
        <EyeOff class="size-4" /> Hide
      </button>
    </div>

    <dl class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      <div v-for="row in rows" :key="row.label" class="glass rounded-2xl p-4">
        <dt class="text-xs text-ink-faint">{{ row.label }}</dt>
        <dd class="mt-1 text-lg font-semibold">{{ row.value }}</dd>
      </div>
    </dl>

    <div v-if="player.diag" class="glass rounded-2xl p-4">
      <p class="text-xs text-ink-faint">User agent</p>
      <p class="mt-1 text-xs break-all select-text">{{ player.diag.userAgent }}</p>
    </div>

    <section>
      <h2 class="text-sm font-semibold">Bridge log</h2>
      <ol class="glass mt-2 max-h-80 overflow-y-auto rounded-2xl p-2 font-mono text-xs select-text">
        <li v-if="!player.logs.length" class="px-2 py-1.5 text-ink-faint">Nothing logged yet.</li>
        <li v-for="(entry, i) in player.logs" :key="i" class="px-2 py-1.5" :class="levelClass[entry.level]">
          <span class="text-ink-faint">{{ entry.at.toLocaleTimeString() }}</span>
          · {{ entry.message }}
        </li>
      </ol>
    </section>
  </div>
</template>
