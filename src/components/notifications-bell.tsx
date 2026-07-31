"use client";

import { Bell, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PlatformNotification } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/notifications?limit=6", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { notifications: [] }))
      .then((payload) => {
        if (active) setNotifications(payload.notifications ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleToggle() {
    setOpen((current) => (notifications.length ? !current : false));
  }

  function markAsRead(notificationId: string) {
    setOpen(false);
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));

    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
      keepalive: true,
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative grid size-10 place-items-center rounded-md border border-border bg-white text-charcoal hover:bg-muted"
        onClick={handleToggle}
        title="Notificações"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
        {notifications.length ? (
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-danger text-[10px] font-bold text-white">
            {notifications.length}
          </span>
        ) : null}
      </button>
      {open && notifications.length ? (
        <div className="absolute right-0 z-40 mt-2 w-[calc(100vw-2rem)] max-w-80 rounded-md border border-border bg-white p-2 shadow-xl sm:w-80">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.action_url ?? "/tecnico"}
              className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
              onClick={() => markAsRead(notification.id)}
            >
              <p className="font-semibold text-charcoal">{notification.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {notification.body}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatDateTime(notification.created_at)}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
