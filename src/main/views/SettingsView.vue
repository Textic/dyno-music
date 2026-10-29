<script setup lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import * as autostart from "@tauri-apps/plugin-autostart";
import { Download, LogIn, LogOut, RefreshCw, RotateCcw } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import ChoiceSetting from "@/main/components/ChoiceSetting.vue";
import DeveloperSettings from "@/main/components/DeveloperSettings.vue";
import ShortcutSettings from "@/main/components/ShortcutSettings.vue";
import ToggleSwitch from "@/main/components/ToggleSwitch.vue";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import { useUpdatesStore } from "@/main/stores/updates";
import * as api from "@/shared/api";
import type { AudioQuality, Settings, Theme } from "@/shared/types";

const player = usePlayerStore();
const ui = useUiStore();
const updates = useUpdatesStore();

const settings = ref<Settings | null>(null);
const version = ref("");
const confirmingSignOut = ref(false);
const confirmingReset = ref(false);
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

/** Saves the settings with `patch` applied, or exactly `patch` when `replace` is set. */
async function update(patch: Partial<Settings>, replace = false): Promise<void> {
  if (!settings.value) return;
  try {
    await api.setSettings((replace ? patch : { ...settings.value, ...patch }) as Settings);
  } catch (err) {
    ui.toast(String(err), "error");
  }
  // Read back what was saved: Rust fills in defaults, and saves even when a shortcut fails.
  settings.value = await api.getSettings();
}

/** Rust puts back the default for every action that's missing. */
function resetShortcuts(): Promise<void> {
  return update({ shortcuts: {} as Settings["shortcuts"] });
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

/**
 * Every setting back to its default: Rust fills an empty settings object with the defaults
 * (shortcuts included), and launch at login, which lives in the system, is turned off.
 */
async function resetAll(): Promise<void> {
  confirmingReset.value = false;
  await update({} as Settings, true);
  if (launchAtLogin.value) await setLaunchAtLogin(false);
  ui.toast("Settings reset to their defaults");
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

const QUALITIES: { value: AudioQuality; label: string }[] = [
  { value: "auto", label: "Account" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

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
          <ToggleSwitch
            :model-value="settings.discordPresence"
            label="Show what I'm listening to on Discord"
            description="Your Discord profile shows the song, its artwork and progress while Discord is open on this computer."
            @update:model-value="update({ discordPresence: $event })"
          />
        </template>
        <p v-else class="py-3 text-sm text-ink-faint">Loading…</p>
      </div>
    </section>

    <section>
      <h2 :class="sectionTitle">Appearance</h2>
      <div :class="[card, 'divide-y divide-white/5']">
        <template v-if="settings">
          <ChoiceSetting
            :model-value="settings.theme"
            label="Theme"
            description="System follows your computer's light or dark mode."
            :options="THEMES"
            @update:model-value="update({ theme: $event })"
          />
          <ToggleSwitch
            :model-value="settings.artworkAccent"
            label="Colour from the artwork"
            description="Buttons and highlights take the main colour of the song that's playing."
            @update:model-value="update({ artworkAccent: $event })"
          />
          <ToggleSwitch
            :model-value="settings.reduceMotion"
            label="Reduce motion"
            description="Turns off animations and smooth scrolling. Your system's own setting also does this."
            @update:model-value="update({ reduceMotion: $event })"
          />
        </template>
        <p v-else class="py-3 text-sm text-ink-faint">Loading…</p>
      </div>
    </section>

    <section>
      <h2 :class="sectionTitle">Playback</h2>
      <div :class="[card, 'divide-y divide-white/5']">
        <template v-if="settings">
          <ChoiceSetting
            :model-value="settings.audioQuality"
            label="Audio quality"
            description="Applies from the next song. Account keeps your YouTube Music setting; High needs Premium."
            :options="QUALITIES"
            @update:model-value="update({ audioQuality: $event })"
          />
          <ToggleSwitch
            :model-value="settings.skipAds"
            label="Skip ads"
            description="Mutes YouTube Music's ads and skips them as soon as they start. Only matters without Premium."
            @update:model-value="update({ skipAds: $event })"
          />
        </template>
        <p v-else class="py-3 text-sm text-ink-faint">Loading…</p>
      </div>
    </section>

    <section>
      <div class="mb-2 flex items-end justify-between gap-4 px-1">
        <h2 :class="[sectionTitle, '!mb-0 !px-0']">Shortcuts</h2>
        <button
          v-if="settings"
          class="inline-flex items-center gap-1.5 text-xs text-ink-faint transition hover:text-ink"
          @click="resetShortcuts"
        >
          <RotateCcw class="size-3.5" /> Reset to defaults
        </button>
      </div>
      <div :class="card">
        <p class="pt-2 pb-1 text-xs text-ink-faint">
          Click a shortcut and press the new keys; Backspace removes it. The globe makes it work from any app.
        </p>
        <ShortcutSettings v-if="settings" :shortcuts="settings.shortcuts" @change="update({ shortcuts: $event })" />
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
          <button
            v-else
            :class="[action, '!border-rose-500/40 !bg-rose-600/15 text-rose-500 hover:!bg-rose-600/25']"
            @click="confirmingSignOut = true"
          >
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
      <h2 :class="sectionTitle">Developers</h2>
      <div :class="card">
        <DeveloperSettings v-if="settings" :settings="settings" @update="update" />
        <p v-else class="py-3 text-sm text-ink-faint">Loading…</p>
      </div>
    </section>

    <section>
      <h2 :class="sectionTitle">Reset</h2>
      <div :class="[card, 'flex flex-wrap items-center gap-4 py-5']">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">Reset all settings</p>
          <p class="mt-0.5 text-xs text-ink-faint">
            Puts every setting on this page back to its default, shortcuts included. Your Google
            session and library stay as they are.
          </p>
        </div>
        <template v-if="confirmingReset">
          <button :class="action" @click="confirmingReset = false">Cancel</button>
          <button :class="[action, '!bg-rose-600/80 hover:!bg-rose-600']" :disabled="!settings" @click="resetAll">
            <RotateCcw class="size-4" /> Reset
          </button>
        </template>
        <button v-else :class="action" :disabled="!settings" @click="confirmingReset = true">
          <RotateCcw class="size-4" /> Reset all settings
        </button>
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
