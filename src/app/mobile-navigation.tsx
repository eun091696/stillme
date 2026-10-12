"use client";

import {
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

export function MobileNavigation({
  children,
  className = "",
  navLabel,
}: {
  children: ReactNode;
  className?: string;
  navLabel: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      const details = detailsRef.current;
      const target = event.target;
      if (!details?.open || !(target instanceof Node) || details.contains(target)) {
        return;
      }
      closeMenu(true);
    }

    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, []);

  function closeMenu(restoreFocus = false) {
    const details = detailsRef.current;
    if (!details) return;
    details.open = false;
    if (restoreFocus) {
      window.setTimeout(() => summaryRef.current?.focus(), 0);
    }
  }

  function closeAfterNavigation(event: MouseEvent<HTMLElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest("a, button")) closeMenu();
  }

  return (
    <details
      className={`mobile-nav ${className}`.trim()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeMenu(true);
        }
      }}
      ref={detailsRef}
    >
      <summary ref={summaryRef}>MENU</summary>
      <button
        aria-label="메뉴 닫기"
        className="mobile-nav-backdrop"
        onClick={() => closeMenu(true)}
        type="button"
      />
      <nav aria-label={navLabel} onClick={closeAfterNavigation}>
        {children}
      </nav>
    </details>
  );
}
