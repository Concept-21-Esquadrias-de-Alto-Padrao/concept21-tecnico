"use client";

import { Bell, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlatformNotification } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="relative">
      <button
        type="button"
        className="relative grid size-10 place-items-center rounded-md border border-border bg-white text-charcoal hover:bg-muted"
        title="Notificações"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
        {notifications.length ? (
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-danger text-[10px] font-bold text-white">
            {notifications.length}
          </span>
        ) : null}
      </button>
      {notifications.length ? (
        <div className="absolute right-0 z-40 mt-2 hidden w-80 rounded-md border border-border bg-white p-2 shadow-xl sm:block">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.action_url ?? "/tecnico"}
              className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
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
