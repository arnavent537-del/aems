"use client";

import { useEffect } from "react";

export default function OrientationLock() {
  useEffect(() => {
    const lock = () => {
      try {
        const o = screen.orientation as ScreenOrientation & {
          lock?: (orientation: "portrait") => Promise<void>;
        };
        if (o && typeof o.lock === "function") {
          o.lock("portrait").catch(() => {});
        }
      } catch {
        // Screen Orientation API not available in this context — ignore.
      }
    };

    lock();
    document.addEventListener("fullscreenchange", lock);
    return () => document.removeEventListener("fullscreenchange", lock);
  }, []);

  return null;
}
