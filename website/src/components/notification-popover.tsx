"use client";

import { Bell, Megaphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCopy } from "@/lib/copy";
import type { Locale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type AnnouncementItem = {
  id?: string | number;
  type?: string;
  content?: string;
  extra?: string;
  publishDate?: string;
};

type Props = {
  locale: Locale;
};

const primaryButtonStyle = {
  backgroundColor: "#070707",
  color: "#fafafa",
};

function hashString(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return hash.toString(36);
}

function getAnnouncementKey(item: AnnouncementItem): string {
  if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
  return `hash:${hashString(
    JSON.stringify({
      publishDate: item.publishDate || "",
      content: (item.content || "").trim(),
      extra: (item.extra || "").trim(),
      type: item.type || "",
    })
  )}`;
}

function getStoredSet(key: string): Set<string> {
  try {
    const value = window.localStorage.getItem(key);
    return new Set(value ? (JSON.parse(value) as string[]) : []);
  } catch {
    return new Set();
  }
}

function setStoredSet(key: string, value: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify([...value]));
}

export function NotificationPopover({ locale }: Props) {
  const copy = getCopy(locale);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notice" | "announcements">("notice");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [readNotice, setReadNotice] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("flatkey-notice-read") || ""
  );
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : getStoredSet("flatkey-announcements-read")
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [noticeResponse, statusResponse] = await Promise.all([
          fetch("/api/notice", { signal: controller.signal }).then((response) => response.json()).catch(() => null),
          fetch("/api/status", { signal: controller.signal }).then((response) => response.json()).catch(() => null),
        ]);
        const nextNotice =
          noticeResponse?.success && typeof noticeResponse.data === "string" ? noticeResponse.data.trim() : "";
        const status = statusResponse?.data || statusResponse || {};
        const nextAnnouncements =
          status?.announcements_enabled && Array.isArray(status.announcements)
            ? (status.announcements as AnnouncementItem[]).slice(0, 20)
            : [];
        setNotice(nextNotice);
        setAnnouncements(nextAnnouncements);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const unreadCount = useMemo(() => {
    const noticeUnread = notice && notice !== readNotice ? 1 : 0;
    const announcementUnread = announcements.filter((item) => !readAnnouncements.has(getAnnouncementKey(item))).length;
    return noticeUnread + announcementUnread;
  }, [announcements, notice, readAnnouncements, readNotice]);

  function markRead(tab: "notice" | "announcements") {
    if (tab === "notice" && notice) {
      window.localStorage.setItem("flatkey-notice-read", notice);
      setReadNotice(notice);
    }
    if (tab === "announcements") {
      const next = new Set(readAnnouncements);
      announcements.forEach((item) => next.add(getAnnouncementKey(item)));
      setStoredSet("flatkey-announcements-read", next);
      setReadAnnouncements(next);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      markRead(activeTab);
    }
    setOpen(nextOpen);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium text-muted-foreground transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-foreground/10 aria-expanded:bg-muted aria-expanded:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0"
        aria-label={copy.nav.notifications}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => handleOpenChange(!open)}
      >
        <Bell className="size-[1.2rem]" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold tabular-nums text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      <div
        className={cn(
          "absolute right-0 top-[calc(100%+0.5rem)] z-50 flex w-[min(26rem,calc(100vw-1rem))] origin-top-right flex-col gap-3 rounded-lg bg-background p-3 text-sm shadow-lg ring-1 ring-foreground/10 transition-all duration-100",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
        )}
        role="dialog"
        aria-label={copy.nav.systemAnnouncements}
      >
        <div className="px-1">
          <h2 className="text-sm font-semibold">{copy.nav.systemAnnouncements}</h2>
          <p className="text-xs text-muted-foreground">{copy.nav.latestPlatformUpdates}</p>
        </div>

        <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === "notice" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
            onClick={() => {
              setActiveTab("notice");
              markRead("notice");
            }}
          >
            <Bell className="size-3.5" aria-hidden="true" />
            {copy.nav.notice}
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === "announcements" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
            onClick={() => {
              setActiveTab("announcements");
              markRead("announcements");
            }}
          >
            <Megaphone className="size-3.5" aria-hidden="true" />
            {copy.nav.timeline}
          </button>
        </div>

        <div className="max-h-[min(52vh,28rem)] overflow-auto pr-1">
          {activeTab === "notice" ? (
            <NoticeBody loading={loading} notice={notice} emptyText={copy.nav.noAnnouncements} loadingText={copy.nav.loading} />
          ) : (
            <AnnouncementBody
              loading={loading}
              announcements={announcements}
              emptyText={copy.nav.noSystemAnnouncements}
              loadingText={copy.nav.loading}
            />
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex h-7 items-center justify-center rounded-md px-2.5 text-[0.8rem] font-medium transition-opacity hover:opacity-90"
            style={primaryButtonStyle}
            onClick={() => handleOpenChange(false)}
          >
            {copy.nav.close}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoticeBody(props: { loading: boolean; notice: string; emptyText: string; loadingText: string }) {
  if (props.loading) return <EmptyState icon={<Bell />} title={props.loadingText} />;
  if (!props.notice) return <EmptyState icon={<Bell />} title={props.emptyText} />;
  return <div className="whitespace-pre-wrap leading-6 text-foreground">{props.notice}</div>;
}

function AnnouncementBody(props: {
  loading: boolean;
  announcements: AnnouncementItem[];
  emptyText: string;
  loadingText: string;
}) {
  if (props.loading) return <EmptyState icon={<Megaphone />} title={props.loadingText} />;
  if (props.announcements.length === 0) return <EmptyState icon={<Megaphone />} title={props.emptyText} />;

  return (
    <div className="flex flex-col">
      {props.announcements.map((item, index) => (
        <div key={getAnnouncementKey(item)} className={cn("py-3", index > 0 && "border-t border-border")}>
          <div className="flex items-start gap-3">
            <span className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-violet-500" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="whitespace-pre-wrap text-sm leading-6">{item.content || ""}</div>
              {item.extra ? <div className="whitespace-pre-wrap text-xs text-muted-foreground">{item.extra}</div> : null}
              {item.publishDate ? <div className="text-xs text-muted-foreground">{item.publishDate}</div> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState(props: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">{props.icon}</div>
      <div className="text-sm font-medium text-foreground">{props.title}</div>
    </div>
  );
}
