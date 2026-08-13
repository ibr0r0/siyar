/**
 * What the device can actually do with a compose link.
 *
 * Two behaviours differ enough to change which button should be offered first:
 *
 *  - **Mobile.** `mailto:` is handed to the OS, which opens whichever mail app
 *    is installed and default — Gmail included. The Gmail *web* URL
 *    (`mail.google.com/mail/?view=cm`) does not open the Gmail app: on iOS
 *    Gmail claims no universal link for that address, so it lands in the
 *    browser. On a phone, `mailto:` is the button that works.
 *
 *  - **Windows.** `mailto:` is passed through a command line capped near 2048
 *    characters and is truncated past it. Nothing else has that limit.
 *
 * Detection is deliberately coarse and only ever reorders or relabels; the copy
 * buttons are always present, so a wrong guess costs a click, never a message.
 */

export interface Platform {
  isMobile: boolean;
  isWindows: boolean;
}

export const DEFAULT_PLATFORM: Platform = { isMobile: false, isWindows: false };

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return DEFAULT_PLATFORM;

  const ua = navigator.userAgent;

  // `maxTouchPoints` catches iPads, which report a desktop user agent.
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  const isWindows = /Windows|Win32|Win64/i.test(ua);

  return { isMobile, isWindows };
}
