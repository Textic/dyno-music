<script setup lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import { Eye, LogIn, LogOut } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import ToggleSwitch from "@/main/components/ToggleSwitch.vue";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import * as api from "@/shared/api";
import type { Settings } from "@/shared/types";

const player = usePlayerStore();
const ui = useUiStore();

const settings = ref<Settings | null>(null);
const version = ref("");
const confirmingSignOut = ref(false);

onMounted(async () => {
  [settings.value, version.value] = await Promise.all([api.getSettings(), getVersion()]);
});

async function update(patch: Partial<Settings>): Promise<void> {
  if (!settings.value) return;
  const next = { ...settings.value, ...patch };
  try {
    await api.setSettings(next);
    settings.value = next;
  } catch (err) {
    ui.toast(`Could not save settings: ${err}`, "error");
  }
}

async function signOut(): Promise<void> {
  confirmingSignOut.value = false;
  try {
    await api.signOut();
    ui.toast("Signed out");
  } catch (err) {
    ui.toast(`Could not sign out: ${err}`, "error");
  }
}

const card = "glass rounded-3xl px-6 py-3";
const sectionTitle = "mb-2 px-1 text-xs font-semibold tracking-widest text-ink-faint uppercase";
const action =
  "glass glass-hover inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50";
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-8">
    <h1 class="text-3xl font-extrabold tracking-tight">Settings</h1>

    <section>
      <h2 :class="sectionTitle">Desktop</h2>
      <div :class="[card, 'divide-y divide-white/5']">
        <template v-if="settings">
          <ToggleSwitch
            :model-value="settings.closeToTray"
            label="Keep playing in the tray"
            description="Closing the window hides Dyno Music in the system tray instead of quitting."
            @update:model-value="update({ closeToTray: $event })"
          />
          <ToggleSwitch
            :model-value="settings.mediaControls"
            label="Media keys and system controls"
            description="Play, pause and skip from your keyboard's media keys and the system media panel."
            @update:model-value="update({ mediaControls: $event })"
          />
        </template>
        <p v-else class="py-3 text-sm text-ink-faint">Loading…</p>
      </div>
    </section>

    <section>
      <h2 :class="sectionTitle">Account</h2>
      <div :class="[card, 'flex flex-wrap items-center gap-4 py-5']">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">
            {{ !player.session ? "Connecting to YouTube Music…" : player.signedIn ? "Signed in with Google" : "Not signed in" }}
          </p>
          <p class="mt-0.5 text-xs text-ink-faint">
            Your library, likes, playlists and history come from your YouTube Music account.
          </p>
        </div>
        <template v-if="player.signedIn">
          <template v-if="confirmingSignOut">
            <button :class="action" @click="confirmingSignOut = false">Cancel</button>
            <button :class="[action, '!bg-rose-600/80 hover:!bg-rose-600']" @click="signOut">
              <LogOut class="size-4" /> Sign out
            </button>
          </template>
          <button v-else :class="action" @click="confirmingSignOut = true">
            <LogOut class="size-4" /> Sign out
          </button>
        </template>
        <button v-else-if="player.session" :class="action" :disabled="player.signingIn" @click="player.signIn()">
          <LogIn class="size-4" />
          {{ player.signingIn ? "Waiting for Google…" : "Sign in with Google" }}
        </button>
      </div>
    </section>

    <section>
      <h2 :class="sectionTitle">Troubleshooting</h2>
      <div :class="[card, 'flex flex-wrap items-center gap-4 py-5']">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">YouTube Music window</p>
          <p class="mt-0.5 text-xs text-ink-faint">
            Shows the hidden page that plays your music. Closing it hides it again; playback continues.
          </p>
        </div>
        <button :class="action" @click="api.showPlayer()"><Eye class="size-4" /> Show</button>
      </div>
    </section>

    <section>
      <h2 :class="sectionTitle">About</h2>
      <div :class="[card, 'py-5 text-sm']">
        <p class="font-medium">Dyno Music {{ version && `v${version}` }}</p>
        <p class="mt-1 text-xs text-ink-faint">
          An unofficial YouTube Music client. Not affiliated with or endorsed by Google or YouTube.
        </p>
      </div>
    </section>
  </div>
</template>
