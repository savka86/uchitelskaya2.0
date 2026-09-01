"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImportantNews } from "@/components/ImportantNews";

export function NewsPortal() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const find = () => setTarget(document.querySelector(".sidebar"));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;
  return createPortal(<ImportantNews />, target);
}
