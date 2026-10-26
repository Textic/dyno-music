<script setup lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import * as autostart from "@tauri-apps/plugin-autostart";
import { Download, Eye, LogIn, LogOut, RefreshCw } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import ToggleSwitch from "@/main/components/ToggleSwitch.vue";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import { useUpdatesStore } from "@/main/stores/updates";
import * as api from "@/shared/api";
import type { Settings } from "@/shared/types";

const player = usePlayerStore();
const ui = useUiStore();
const updates = useUpdatesStore();

const settings = ref<Settings | null>(null);
const version = ref("");
const confirmingSignOut = ref(false);
/** Read from the system itself (e.g. the Windows startup list), not from settings.json. */
const launchAtLogin = ref<boolean | null>(null);

onMounted(async () => {
  [settings.value, version.value, launchAtLogin.value] = await Promise.all([
    api.getSettings(),
    getVersion(),
    autostart.isEnabled().catch(() => null),
  ]);
});

async function setLaunchAtLogin(on: boolean): Promise<void> {
  try {
    await (on ? autostart.enable() : autostart.disable());
    launchAtLogin.value = await autostart.isEnabled();
  } catch (err) {
    ui.toast(`Could not change launch at login: ${err}`, "error");
  }
}

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
          <ToggleSwitch
            v-if="launchAtLogin !== null"
            :model-value="launchAtLogin"
            label="Launch at login"
            description="Starts Dyno Music in the tray when you sign in to your computer."
            @update:model-value="setLaunchAtLogin($event)"
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
      <h2 :class="sectionTitle">Updates</h2>
      <div :class="[card, 'flex flex-wrap items-center gap-4 py-5']">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">
            <template v-if="updates.status === 'checking'">Checking for updates…</template>
            <template v-else-if="updates.status === 'none'">You're on the latest version</template>
            <template v-else-if="updates.status === 'available'">Version {{ updates.version }} is available</template>
            <template v-else-if="updates.status === 'downloading'">Downloading version {{ updates.version }}…</template>
            <template v-else-if="updates.status === 'error'">Couldn't check for updates</template>
            <template v-else>Dyno Music {{ version && `v${version}` }}</template>
          </p>
          <p class="mt-0.5 text-xs text-ink-faint">
            <template v-if="updates.status === 'error'">{{ updates.error }}</template>
            <template v-else>New versions come from GitHub Releases; Dyno Music checks a few seconds after it starts.</template>
          </p>
        </div>
        <button v-if="updates.status === 'available'" :class="[action, '!bg-accent hover:brightness-110']" @click="updates.install()">
          <Download class="size-4" /> Install & restart
        </button>
        <button
          v-else
          :class="action"
          :disabled="updates.status === 'checking' || updates.status === 'downloading'"
          @click="updates.checkNow()"
        >
          <RefreshCw class="size-4" :class="updates.status === 'checking' && 'animate-spin'" /> Check now
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
