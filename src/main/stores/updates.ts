import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { defineStore } from "pinia";
import { ref } from "vue";

export type UpdateStatus = "idle" | "checking" | "none" | "available" | "downloading" | "error";

/**
 * In-app updates from GitHub Releases (latest.json, see .github/workflows/release.yml).
 * Updates are signed; the updater rejects anything not signed with the project's key.
 */
export const useUpdatesStore = defineStore("updates", () => {
  const status = ref<UpdateStatus>("idle");
  const version = ref<string | null>(null);
  const notes = ref<string | null>(null);
  /** 0–1 while downloading, when the size is known. */
  const progress = ref<number | null>(null);
  const error = ref<string | null>(null);
  /** The notice was closed with "Later". */
  const dismissed = ref(false);
  let update: Update | null = null;

  /** `quiet` checks (on startup) don't report "no update" or network errors. */
  async function checkNow(quiet = false): Promise<void> {
    if (!isTauri() || status.value === "checking" || status.value === "downloading") return;
    status.value = "checking";
    error.value = null;
    try {
      update = await check();
      if (update) {
        status.value = "available";
        version.value = update.version;
        notes.value = update.body ?? null;
        dismissed.value = false;
      } else {
        status.value = "none";
      }
    } catch (err) {
      status.value = quiet ? "idle" : "error";
      error.value = String(err);
    }
  }

  async function install(): Promise<void> {
    if (!update || status.value === "downloading") return;
    status.value = "downloading";
    progress.value = null;
    let total = 0;
    let downloaded = 0;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total) progress.value = Math.min(downloaded / total, 1);
        }
      });
      await relaunch();
    } catch (err) {
      status.value = "error";
      error.value = String(err);
    }
  }

  return { status, version, notes, progress, error, dismissed, checkNow, install };
});
