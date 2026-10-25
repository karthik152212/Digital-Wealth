"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Compass, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const INTRO_STORAGE_KEY = "dwv-intro-dismissed";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(INTRO_STORAGE_KEY) !== "1";
  } catch {
    // Storage unavailable (private mode) — show the intro dismissibly for
    // the current page view.
    return true;
  }
}

// SSR and hydration never show the intro; the client snapshot takes over
// immediately after hydration.
function getServerSnapshot(): boolean {
  return false;
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

export function FirstTimeIntro() {
  const visible = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "1");
    } catch {
      // Storage unavailable — dismiss only for the current page view.
    }
    emitChange();
  }, []);

  if (!visible) return null;

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
