"use client";

import { useEffect, useState } from "react";
import { Compass, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const INTRO_STORAGE_KEY = "dwv-intro-dismissed";

export function FirstTimeIntro() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setVisible(window.localStorage.getItem(INTRO_STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "1");
    } catch {
      // Storage unavailable (private mode) — the intro just stays dismissible
      // for the current page view.
    }
  }

  if (!mounted || !visible) return null;

  return (
    <aside
      aria-label="Welcome introduction"
      className="relative rounded-xl border bg-card px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Compass className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Welcome to your vault</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start by adding your first asset, then invite nominees and choose
            which assets each one may access. Everything you record stays
            private to you — values are your own estimates.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-label="Dismiss introduction"
          onClick={dismiss}
        >
          <X className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
