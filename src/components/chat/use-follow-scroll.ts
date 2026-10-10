"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Distance from the bottom of the page, in pixels, that still counts as "at the end". */
const BOTTOM_SLACK = 96;

function distanceFromBottom(): number {
  const doc = document.documentElement;
  return doc.scrollHeight - (window.scrollY + window.innerHeight);
}

function scrollToEnd(behavior: ScrollBehavior) {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
}

/**
 * Keeps the newest message in view while it streams, but only while the visitor is at the
 * end of the page. Any upward scroll (wheel, touch, keys or scrollbar) stops following at once,
 * and nothing pulls the page down again until the visitor returns to the end or asks to.
 *
 * Earlier versions called `scrollIntoView({ behavior: "smooth" })` on every streamed chunk:
 * each call restarted a smooth scroll to the bottom and overrode the visitor's own scrolling.
 *
 * @param progress changes whenever content grows (e.g. total characters streamed).
 */
export function useFollowScroll(progress: number) {
  const following = useRef(true);
  const lastY = useRef(0);
  const [detached, setDetached] = useState(false);

  const setFollowing = useCallback((value: boolean) => {
    following.current = value;
    setDetached(!value);
  }, []);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const movedUp = y < lastY.current - 2;
      lastY.current = y;
      // Content growth never moves scrollY up, and our own scrolling only goes down:
      // an upward move is the visitor's.
      if (movedUp && following.current && distanceFromBottom() > 4) setFollowing(false);
      else if (!movedUp && !following.current && distanceFromBottom() <= BOTTOM_SLACK) setFollowing(true);
    };
    // Wheel and touch fire before the scroll itself, so following stops before the next chunk lands.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && following.current) setFollowing(false);
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      // A finger moving down the screen scrolls the page up.
      if ((e.touches[0]?.clientY ?? 0) > touchY + 4 && following.current) setFollowing(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(e.key) && following.current) {
        const target = e.target as HTMLElement | null;
        if (!target?.closest("textarea, input")) setFollowing(false);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [setFollowing]);

  // Before paint, so the new text never flashes below the fold. Instant, never smooth:
  // a smooth scroll still animating when the visitor starts scrolling would fight them.
  useLayoutEffect(() => {
    if (progress > 0 && following.current) {
      scrollToEnd("instant");
      lastY.current = window.scrollY;
    }
  }, [progress]);

  /** Follow again and go to the newest message (the "Latest messages" button, or sending a message). */
  const jumpToLatest = useCallback(() => {
    setFollowing(true);
    scrollToEnd("smooth");
  }, [setFollowing]);

  return { detached, jumpToLatest, follow: () => setFollowing(true) };
}
