"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Owns both Lenis and GSAP/ScrollTrigger, because the two have to share a clock.
 * Lenis animates scroll position on its own RAF; if ScrollTrigger keeps its own,
 * trigger positions resolve against a stale scroll value and reveals fire early
 * or late. So Lenis runs off the GSAP ticker (autoRaf: false) and pushes every
 * scroll into ScrollTrigger.update.
 *
 * Also wires the page-wide reveal: anything marked [data-reveal] rises into
 * place as it enters. Doing it here keeps page.tsx a server component.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gsap.registerPlugin(ScrollTrigger);

    const revealCtx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]");

      targets.forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: reduced ? 0 : 28,
          duration: reduced ? 0 : 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            once: true,
          },
        });
      });
    });

    if (reduced) {
      ScrollTrigger.refresh();
      return () => revealCtx.revert();
    }

    const lenis = new Lenis({
      autoRaf: false,
      anchors: { offset: -80 },
      lerp: 0.11,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      revealCtx.revert();
    };
  }, []);

  return null;
}
