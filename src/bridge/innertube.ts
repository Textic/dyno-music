// Requests to YouTube Music's internal API (InnerTube), made from inside the page so they
// reuse the signed-in session. Responses go back to Rust raw; the UI parses them.

import type { BridgeRequest } from "../shared/types";
import { send } from "./ipc";
import { ytcfg } from "./ytm";

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

async function innertube(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Origin": location.origin,
    "X-Goog-AuthUser": String(ytcfg("SESSION_INDEX") ?? 0),
    "X-Youtube-Client-Name": String(ytcfg("INNERTUBE_CONTEXT_CLIENT_NAME") ?? 67),
    "X-Youtube-Client-Version": String(ytcfg("INNERTUBE_CLIENT_VERSION") ?? ""),
  };
  const visitorData = ytcfg("VISITOR_DATA");
  if (typeof visitorData === "string") headers["X-Goog-Visitor-Id"] = visitorData;
  const auth = await sapisidHash();
  if (auth) headers.Authorization = auth;

  const response = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ ...body, context: ytcfg("INNERTUBE_CONTEXT") }),
  });
  if (!response.ok) throw new Error(`InnerTube "${endpoint}" answered HTTP ${response.status}`);
  return response.json();
}

export async function handleRequest({ id, endpoint, body }: BridgeRequest): Promise<void> {
  try {
    const data = await innertube(endpoint, body);
    await send("bridge_response", { id, ok: true, data });
  } catch (err) {
    await send("bridge_response", { id, ok: false, error: String(err) });
  }
}
