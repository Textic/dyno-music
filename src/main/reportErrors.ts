// Sends the interface's uncaught errors to the terminal (`tauri dev`) and the log, so a blank
// or broken window can be traced: the WebView's own console is out of sight.

import type { App } from "vue";
import { uiLog } from "@/shared/api";

function report(message: string): void {
  console.error(`[dyno] ${message}`);
  uiLog("error", message).catch(() => {});
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
}

export function reportErrors(app: App): void {
  app.config.errorHandler = (error, _instance, info) => report(`Vue (${info}): ${describe(error)}`);
  window.addEventListener("error", (event) => report(`Uncaught: ${describe(event.error ?? event.message)}`));
  window.addEventListener("unhandledrejection", (event) => report(`Unhandled rejection: ${describe(event.reason)}`));
}
