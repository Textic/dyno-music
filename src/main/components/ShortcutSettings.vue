<script setup lang="ts">
import { Globe, X } from "lucide-vue-next";
import { ref } from "vue";
import { canBeGlobal, comboFromEvent, keyLabels, SHORTCUT_LABELS } from "@/main/composables/useShortcuts";
import { useUiStore } from "@/main/stores/ui";
import type { ShortcutAction, ShortcutBinding } from "@/shared/types";

const props = defineProps<{ shortcuts: Record<ShortcutAction, ShortcutBinding> }>();
const emit = defineEmits<{ change: [shortcuts: Record<ShortcutAction, ShortcutBinding>] }>();

const ui = useUiStore();
/** The action waiting for its new keys. */
const recording = ref<ShortcutAction | null>(null);

const actions = Object.keys(SHORTCUT_LABELS) as ShortcutAction[];

function set(action: ShortcutAction, binding: ShortcutBinding): void {
  emit("change", { ...props.shortcuts, [action]: binding });
}

function onRecordKey(action: ShortcutAction, event: KeyboardEvent): void {
  // Keep the keys away from the window's own shortcuts while recording.
  event.preventDefault();
  event.stopPropagation();
  const bare = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
  if (bare && event.key === "Escape") {
    recording.value = null;
    return;
  }
  if (bare && (event.key === "Backspace" || event.key === "Delete")) {
    recording.value = null;
    set(action, { keys: null, global: false });
    return;
  }
  const keys = comboFromEvent(event);
  if (!keys) return;
  recording.value = null;
  const taken = actions.find((other) => other !== action && props.shortcuts[other].keys === keys);
  if (taken) {
    ui.toast(`${keyLabels(keys).join(" + ")} is already used by “${SHORTCUT_LABELS[taken]}”`, "error");
    return;
  }
  const binding = props.shortcuts[action];
  set(action, { keys, global: binding.global && canBeGlobal(keys) });
}

const kbd = "rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-xs font-semibold";
</script>

<template>
  <ul class="divide-y divide-white/5">
    <li v-for="action in actions" :key="action" class="flex items-center gap-3 py-2.5">
      <span class="min-w-0 flex-1 text-sm font-medium">{{ SHORTCUT_LABELS[action] }}</span>

      <button
        class="flex h-8 min-w-28 items-center justify-center gap-1 rounded-lg px-2 text-ink-soft transition hover:bg-white/10"
        :class="recording === action ? 'bg-accent/20 text-ink ring-1 ring-accent' : 'bg-white/5'"
        :aria-label="`Change the shortcut for ${SHORTCUT_LABELS[action]}`"
        @click="recording = recording === action ? null : action"
        @keydown="recording === action && onRecordKey(action, $event)"
        @blur="recording === action && (recording = null)"
      >
        <span v-if="recording === action" class="text-xs">Press keys…</span>
        <template v-else-if="shortcuts[action].keys">
          <kbd v-for="key in keyLabels(shortcuts[action].keys!)" :key="key" :class="kbd">{{ key }}</kbd>
        </template>
        <span v-else class="text-xs text-ink-faint">Not set</span>
      </button>

      <button
        class="grid size-8 place-items-center rounded-lg transition hover:bg-white/10 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        :class="shortcuts[action].global ? 'text-accent-soft' : 'text-ink-faint'"
        :disabled="!shortcuts[action].keys || !canBeGlobal(shortcuts[action].keys!)"
        :aria-pressed="shortcuts[action].global"
        :aria-label="`Use ${SHORTCUT_LABELS[action]} from any app`"
        :title="
          !shortcuts[action].keys || canBeGlobal(shortcuts[action].keys!)
            ? shortcuts[action].global
              ? 'Works from any app'
              : 'Only while Dyno Music has focus; click to use it from any app'
            : 'Add Ctrl, Alt or Shift to use it from any app'
        "
        @click="set(action, { ...shortcuts[action], global: !shortcuts[action].global })"
      >
        <Globe class="size-4" />
      </button>

      <button
        class="grid size-8 place-items-center rounded-lg text-ink-faint transition hover:bg-white/10 hover:text-ink disabled:invisible"
        :disabled="!shortcuts[action].keys"
        :aria-label="`Remove the shortcut for ${SHORTCUT_LABELS[action]}`"
        title="Remove"
        @click="set(action, { keys: null, global: false })"
      >
        <X class="size-4" />
      </button>
    </li>
  </ul>
</template>
