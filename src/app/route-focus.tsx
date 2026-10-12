"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function RouteFocus() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      document.getElementById("main-content")?.focus();
      previousPathname.current = pathname;
    }
  }, [pathname]);

  return null;
}
