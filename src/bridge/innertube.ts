// Requests to YouTube Music's internal API (InnerTube), made from inside the page so they
// reuse the signed-in session. Responses go back to Rust raw; the UI parses them.

import type { BridgeRequest, InnertubeClient } from "../shared/types";
import { send } from "./ipc";
import { networkManager, ytcfg } from "./ytm";

function cookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Authorization header YouTube expects from signed-in clients. */
async function sapisidHash(): Promise<string | null> {
  const sapisid = cookie("SAPISID") ?? cookie("__Secure-3PAPISID");
  if (!sapisid) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const input = new TextEncoder().encode(`${timestamp} ${sapisid} ${location.origin}`);
  const digest = await crypto.subtle.digest("SHA-1", input);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `SAPISIDHASH ${timestamp}_${hex}`;
}

/** Other clients the page can pretend to be; the session and the rest of the context stay. */
const CLIENTS: Record<InnertubeClient, { name: string; id: number; version: string }> = {
  // YouTube Music for Android: its "browse" for a lyrics page answers with timed lyrics.
  android: { name: "ANDROID_MUSIC", id: 21, version: "7.21.50" },
};

/** The page's own context, or a copy of it as another client. */
function contextFor(client?: InnertubeClient | null): unknown {
  const context = ytcfg("INNERTUBE_CONTEXT") as { client?: Record<string, unknown> } | undefined;
  if (!client || !context) return context;
  const { name, version } = CLIENTS[client];
  return { ...context, client: { ...context.client, clientName: name, clientVersion: version } };
}

/** Fallback for when the page's own client is not available, and the way to ask as another client. */
async function manualFetch(
  endpoint: string,
  body: Record<string, unknown>,
  client?: InnertubeClient | null,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Origin": location.origin,
    "X-Goog-AuthUser": String(ytcfg("SESSION_INDEX") ?? 0),
    "X-Youtube-Client-Name": String(client ? CLIENTS[client].id : (ytcfg("INNERTUBE_CONTEXT_CLIENT_NAME") ?? 67)),
    "X-Youtube-Client-Version": String(client ? CLIENTS[client].version : (ytcfg("INNERTUBE_CLIENT_VERSION") ?? "")),
  };
  const visitorData = ytcfg("VISITOR_DATA");
  if (typeof visitorData === "string") headers["X-Goog-Visitor-Id"] = visitorData;
  const auth = await sapisidHash();
  if (auth) headers.Authorization = auth;

  const response = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ ...body, context: contextFor(client) }),
  });
  if (!response.ok) throw new Error(`InnerTube "${endpoint}" answered HTTP ${response.status}`);
  return response.json();
}

export function innertube(
  endpoint: string,
  body: Record<string, unknown>,
  client?: InnertubeClient | null,
): Promise<unknown> {
  const manager = client ? null : networkManager();
  return manager ? manager.fetch(`/${endpoint}`, body) : manualFetch(endpoint, body, client);
}

export async function handleRequest({ id, endpoint, body, client }: BridgeRequest): Promise<void> {
  try {
    const data = await innertube(endpoint, body, client);
    await send("bridge_response", { id, ok: true, data });
  } catch (err) {
    await send("bridge_response", { id, ok: false, error: String(err) });
  }
}
