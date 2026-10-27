// Gets YouTube Music's ads out of the way for accounts without Premium, once the user turns it
// on in Settings: an ad is muted the moment it shows up, then skipped (the skip button when
// there is one, otherwise jumping to its end). Skipping is used instead of blocking ad
// requests, which YouTube detects and can answer by refusing to play anything at all.

import { log } from "./ipc";
import { isAdShowing, videoElement } from "./ytm";

const CHECK_EVERY_MS = 250;
const SKIP_BUTTONS = ".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern";

/** The <video> this module muted, so the user's own mute is never undone. */
let mutedByUs: HTMLVideoElement | null = null;
let inAd = false;
let enabled = false;
/** Only runs while the setting is on: most people never turn it on. */
let timer = 0;

export function setSkipAds(on: boolean): void {
  enabled = on;
  if (on && !timer) {
    timer = window.setInterval(check, CHECK_EVERY_MS);
  } else if (!on && timer) {
    clearInterval(timer);
    timer = 0;
    // Turned off in the middle of an ad: give the sound back.
    check();
  }
}

function skip(video: HTMLVideoElement | null): void {
  const button = document.querySelector<HTMLElement>(SKIP_BUTTONS);
  if (button) {
    button.click();
    return;
  }
  if (video && Number.isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.25) {
    video.currentTime = video.duration;
  }
}

function check(): void {
  const video = videoElement();
  if (enabled && isAdShowing()) {
    if (!inAd) {
      inAd = true;
      log("info", "Skipping an ad");
    }
    if (video && !video.muted) {
      video.muted = true;
      mutedByUs = video;
    }
    skip(video);
    return;
  }
  if (!inAd) return;
  inAd = false;
  if (mutedByUs) {
    mutedByUs.muted = false;
    mutedByUs = null;
  }
}
