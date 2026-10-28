<script setup lang="ts">
import type { UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BookOpen, Copy, Eye, EyeOff, RefreshCw } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ToggleSwitch from "@/main/components/ToggleSwitch.vue";
import { useUiStore } from "@/main/stores/ui";
import * as api from "@/shared/api";
import type { ApiStatus, Settings } from "@/shared/types";

const DOCS_URL = "https://github.com/Textic/dyno-music/blob/main/docs/websocket-api.md";

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const ui = useUiStore();
const status = ref<ApiStatus | null>(null);
const showToken = ref(false);
const confirmingRegenerate = ref(false);
/** Edited here and saved on blur or Enter, not on every keystroke. */
const port = ref(String(props.settings.apiPort));
watch(
  () => props.settings.apiPort,
  (next) => (port.value = String(next)),
);

const address = computed(() => `ws://127.0.0.1:${props.settings.apiPort}/ws?token=${props.settings.apiToken}`);
const shownAddress = computed(() =>
  showToken.value ? address.value : address.value.replace(props.settings.apiToken, "•".repeat(12)),
);

const statusText = computed(() => {
  const s = status.value;
  if (!s || !props.settings.apiEnabled) return "";
  if (s.error) return s.error;
  if (!s.running) return "Starting…";
  if (s.clients === 0) return "Running · no apps connected";
  return `Running · ${s.clients} ${s.clients === 1 ? "app" : "apps"} connected`;
});

function savePort(): void {
  const value = Number(port.value);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    ui.toast("The port must be a number from 1024 to 65535", "error");
    port.value = String(props.settings.apiPort);
    return;
  }
  if (value !== props.settings.apiPort) emit("update", { apiPort: value });
}

async function copy(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ui.toast(`${what} copied`);
  } catch {
    ui.toast(`Could not copy the ${what.toLowerCase()}`, "error");
  }
}

/** Rust makes a new token when it gets an empty one; connected apps are disconnected. */
function regenerate(): void {
  confirmingRegenerate.value = false;
  emit("update", { apiToken: "" });
}

function openDocs(): void {
  openUrl(DOCS_URL).catch((err) => ui.toast(`Could not open the docs: ${err}`, "error"));
}

let unlisten: UnlistenFn | undefined;
onMounted(async () => {
  unlisten = await api.onApiStatus((next) => (status.value = next));
  status.value = await api.apiStatus();
});
onBeforeUnmount(() => unlisten?.());

const action =
  "glass glass-hover inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-50";
</script>

<template>
  <div class="divide-y divide-white/5">
    <ToggleSwitch
      :model-value="settings.apiEnabled"
      label="Allow other apps to control Dyno Music"
      description="Starts a WebSocket API on this computer for tools like a Stream Deck plugin, an OBS overlay or a bot. Apps need the token below."
      @update:model-value="emit('update', { apiEnabled: $event })"
    />

    <template v-if="settings.apiEnabled">
      <div class="flex items-center gap-4 py-3">
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">Status</span>
          <span class="mt-0.5 block text-xs" :class="status?.error ? 'text-rose-300' : 'text-ink-faint'">
            {{ statusText }}
          </span>
        </span>
        <label class="flex items-center gap-2 text-xs text-ink-faint">
          Port
          <input
            v-model="port"
            inputmode="numeric"
            class="w-20 rounded-lg bg-white/5 px-2 py-1.5 text-sm text-ink tabular-nums outline-none focus:ring-1 focus:ring-accent"
            aria-label="Port"
            @blur="savePort"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
        </label>
      </div>

      <div class="flex flex-col gap-2 py-3">
        <span class="text-sm font-medium">Address</span>
        <code class="block truncate rounded-lg bg-white/5 px-3 py-2 text-xs text-ink-soft select-text">{{ shownAddress }}</code>
        <div class="flex flex-wrap gap-2">
          <button :class="action" @click="copy(address, 'Address')"><Copy class="size-3.5" /> Copy address</button>
          <button :class="action" @click="copy(settings.apiToken, 'Token')"><Copy class="size-3.5" /> Copy token</button>
          <button :class="action" @click="showToken = !showToken">
            <EyeOff v-if="showToken" class="size-3.5" />
            <Eye v-else class="size-3.5" />
            {{ showToken ? "Hide token" : "Show token" }}
          </button>
          <template v-if="confirmingRegenerate">
            <button :class="action" @click="confirmingRegenerate = false">Cancel</button>
            <button :class="[action, '!bg-rose-600/80 hover:!bg-rose-600']" @click="regenerate">
              <RefreshCw class="size-3.5" /> New token, disconnect apps
            </button>
          </template>
          <button v-else :class="action" @click="confirmingRegenerate = true">
            <RefreshCw class="size-3.5" /> Regenerate token
          </button>
        </div>
      </div>
    </template>

    <div class="flex items-center gap-4 py-3">
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-medium">API documentation</span>
        <span class="mt-0.5 block text-xs text-ink-faint">Every message, with examples, on GitHub.</span>
      </span>
      <button :class="action" @click="openDocs"><BookOpen class="size-3.5" /> API docs</button>
    </div>
  </div>
</template>
