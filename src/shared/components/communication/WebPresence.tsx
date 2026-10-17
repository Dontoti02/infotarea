"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Mounted in the shared dashboard: presence includes use of courses, tasks, etc.
export function WebPresence({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!userId) return;
    const sessionId = crypto.randomUUID();
    const supabase = createClient();
    let stopped = false;
    let queue = Promise.resolve();

    const send = async (active: boolean) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        await fetch("/api/communication/presence", {
          method: active ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          credentials: "same-origin",
          keepalive: !active,
          signal: controller.signal,
        });
      } catch {
        // A lost connection expires server-side; it never means online forever.
      } finally {
        window.clearTimeout(timeout);
      }
    };
    const sync = () => {
      queue = queue.then(() => send(!stopped && document.visibilityState === "visible" && navigator.onLine));
    };
    const leave = () => { void send(false); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") { stopped = true; sync(); }
    });
    sync();
    const timer = window.setInterval(sync, 15_000);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("pagehide", leave);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("pagehide", leave);
      subscription.unsubscribe();
      sync();
    };
  }, [userId]);
  return null;
}
