"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImportantNews } from "@/components/ImportantNews";

export function NewsPortal() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const find = () => {
      setTarget(document.querySelector(".sidebar"));

      const route2Map = document.querySelector('.map-panel[aria-label="Яндекс Карта маршрута № 2"]');
      const status = document.querySelector(".topbar-status");
      if (route2Map && status) {
        for (const node of Array.from(status.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes("Автобус в пути")) {
            node.textContent = node.textContent.replace("Автобус в пути", "Автобус №2 в пути");
          }
        }
      }
    };

    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;
  return createPortal(<ImportantNews />, target);
}
