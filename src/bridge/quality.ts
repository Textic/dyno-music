// Audio quality, the way YouTube Music's own setting works: the page reads AUDIO_QUALITY from
// its config whenever it loads a song, so a change applies from the next song on.

import type { AudioQuality } from "../shared/types";
import { ytcfg } from "./ytm";

const VALUES: Record<Exclude<AudioQuality, "auto">, string> = {
  low: "AUDIO_QUALITY_LOW",
  normal: "AUDIO_QUALITY_MEDIUM",
  // The page only asks for it when the account has Premium.
  high: "AUDIO_QUALITY_HIGH",
};

/** The account's own setting, as the page loaded it, for going back to "auto". */
let accountValue: unknown;

export function setAudioQuality(quality: AudioQuality): void {
  if (accountValue === undefined) accountValue = ytcfg("AUDIO_QUALITY") ?? null;
  const value = quality === "auto" ? accountValue : VALUES[quality];
  if (value) window.ytcfg?.set?.("AUDIO_QUALITY", value);
}
