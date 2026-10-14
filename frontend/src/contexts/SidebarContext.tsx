"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { safeGetItem, safeSetItem } from "@/lib/utils";

export const SIDEBAR_COLLAPSED_KEY = "meper_sidebar_collapsed";

export interface SidebarContextValue {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const defaultSidebarContext: SidebarContextValue = {
  isCollapsed: false,
  toggleCollapse: () => {},
  setCollapsed: () => {},
};

const SidebarContext = createContext<SidebarContextValue>(defaultSidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return safeGetItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      safeSetItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    safeSetItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, []);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleCollapse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  return (
    <SidebarContext.Provider
      value={{ isCollapsed, toggleCollapse, setCollapsed }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  return useContext(SidebarContext);
}
