// Phase 0 test page: proves the UI can search, play and pause through the hidden player.

import * as api from "../shared/api";
import { parseSearch, type SearchItem } from "../shared/innertube/parsers";
import { IDLE_STATE, type BridgeDiag, type LogEntry, type PlayerState, type SessionInfo } from "../shared/types";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let state: PlayerState = IDLE_STATE;
/** When `state` arrived, to interpolate the position between updates. */
let stateReceivedAt = performance.now();
let seeking = false;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function reportError(err: unknown): void {
  addLog({ level: "error", message: String(err) });
}

// --- Session -----------------------------------------------------------------

function renderSession(session: SessionInfo | null): void {
  const badge = $("session-badge");
  $("btn-login").hidden = !session || session.loggedIn;
  if (!session) {
    badge.textContent = "Loading YouTube Music…";
    badge.dataset.kind = "pending";
  } else if (session.loggedIn) {
    badge.textContent = "Signed in";
    badge.dataset.kind = "ok";
  } else {
    badge.textContent = "Not signed in";
    badge.dataset.kind = "warn";
  }
}

// --- Player state --------------------------------------------------------------

function currentPosition(): number {
  if (state.status !== "playing") return state.positionSec;
  const elapsed = (performance.now() - stateReceivedAt) / 1000;
  return Math.min(state.positionSec + elapsed, state.track?.durationSec ?? Infinity);
}

function renderState(): void {
  const { track } = state;
  const cover = $<HTMLImageElement>("np-cover");
  if (track?.thumbnail) cover.src = track.thumbnail;
  cover.hidden = !track?.thumbnail;
  $("np-title").textContent = state.isAd ? "Ad" : (track?.title ?? "Nothing playing");
  $("np-artist").textContent = track?.artists.map((a) => a.name).join(", ") ?? "";
  $("np-dur").textContent = formatTime(track?.durationSec ?? 0);
  $<HTMLInputElement>("seek").max = String(Math.floor(track?.durationSec ?? 0));
  $<HTMLInputElement>("volume").value = String(Math.round(state.volume));

  const toggle = $("btn-toggle");
  const playing = state.status === "playing" || state.status === "buffering";
  toggle.textContent = playing ? "⏸" : "▶";
  toggle.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function animatePosition(): void {
  const position = currentPosition();
  $("np-pos").textContent = formatTime(position);
  if (!seeking) $<HTMLInputElement>("seek").value = String(Math.floor(position));
  requestAnimationFrame(animatePosition);
}

// --- Search ------------------------------------------------------------------

async function search(query: string): Promise<void> {
  const status = $("search-status");
  status.textContent = "Searching…";
  $("results").replaceChildren();
  try {
    const raw = await api.ytmApi("search", { query });
    const items = parseSearch(raw);
    status.textContent = items.length ? `${items.length} results` : "No playable results";
    renderResults(items);
  } catch (err) {
    status.textContent = `Error: ${err}`;
  }
}

function renderResults(items: SearchItem[]): void {
  $("results").replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      const img = document.createElement("img");
      img.className = "thumb";
      img.alt = "";
      if (item.thumbnail) img.src = item.thumbnail;
      const meta = document.createElement("div");
      meta.className = "meta";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const subtitle = document.createElement("span");
      subtitle.textContent = item.subtitle;
      meta.append(title, subtitle);
      const play = document.createElement("button");
      play.textContent = "▶";
      play.setAttribute("aria-label", `Play ${item.title}`);
      play.addEventListener("click", () =>
        api.playerCmd({ type: "playVideo", videoId: item.videoId }).catch(reportError),
      );
      li.append(img, meta, play);
      return li;
    }),
  );
}

// --- Diagnostics -------------------------------------------------------------

function renderDiag(diag: BridgeDiag): void {
  $("diag-visibility").textContent = diag.visibility;
  $("diag-max-gap").textContent = `${diag.maxTimerGapMs} ms`;
  $("diag-avg-gap").textContent = `${diag.avgTimerGapMs} ms`;
  $("diag-advancing").textContent =
    diag.playbackAdvancing === null ? "(not playing)" : diag.playbackAdvancing ? "Yes" : "No";
  $("diag-method").textContent = diag.lastPlayMethod ?? "—";
  $("diag-ua").textContent = diag.userAgent;
}

function addLog(entry: LogEntry): void {
  const li = document.createElement("li");
  li.dataset.level = entry.level;
  li.textContent = `${new Date().toLocaleTimeString()} · ${entry.message}`;
  const log = $("log");
  log.prepend(li);
  while (log.children.length > 50) log.lastElementChild?.remove();
}

// --- Wiring ------------------------------------------------------------------

function bindControls(): void {
  $<HTMLFormElement>("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const query = $<HTMLInputElement>("search-input").value.trim();
    if (query) void search(query);
  });
  $("btn-login").addEventListener("click", () => api.showPlayer(true).catch(reportError));
  $("btn-show-player").addEventListener("click", () => api.showPlayer().catch(reportError));
  $("btn-hide-player").addEventListener("click", () => api.hidePlayer().catch(reportError));
  $("btn-toggle").addEventListener("click", () => api.playerCmd({ type: "toggle" }).catch(reportError));
  $("btn-next").addEventListener("click", () => api.playerCmd({ type: "next" }).catch(reportError));
  $("btn-prev").addEventListener("click", () => api.playerCmd({ type: "previous" }).catch(reportError));

  const seek = $<HTMLInputElement>("seek");
  seek.addEventListener("input", () => (seeking = true));
  seek.addEventListener("change", () => {
    seeking = false;
    api.playerCmd({ type: "seek", positionSec: Number(seek.value) }).catch(reportError);
  });
  const volume = $<HTMLInputElement>("volume");
  volume.addEventListener("change", () =>
    api.playerCmd({ type: "volume", value: Number(volume.value) }).catch(reportError),
  );
}

async function init(): Promise<void> {
  bindControls();
  await Promise.all([
    api.onSession(renderSession),
    api.onState((next) => {
      state = next;
      stateReceivedAt = performance.now();
      renderState();
    }),
    api.onDiag(renderDiag),
    api.onLog(addLog),
  ]);
  const snapshot = await api.getSnapshot();
  renderSession(snapshot.session);
  state = snapshot.state;
  renderState();
  requestAnimationFrame(animatePosition);
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch(reportError);
});
