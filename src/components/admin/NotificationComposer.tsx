"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import { parseMadridDatetimeLocal } from "@/lib/utils/adminDatetime";
import { Button } from "@/components/ui/Button";
import { AField, AInput, ATextarea, ASelect } from "@/components/admin/AdminPrimitives";
import type { Activity, NotificationType, TripNotification } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: Timestamp): string {
  return ts.toDate().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

function minutesLabel(mins: number): string {
  if (mins < 60) return `${mins} min before`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m before` : `${h}h before`;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  general: "General",
  upcoming_activity: "Upcoming Activity",
  surprise: "Surprise",
  schedule_change: "Schedule Change",
};

// ─── Notification row ─────────────────────────────────────────────────────────

interface ActivityReminderRowProps {
  activity: Activity;
}

function ActivityReminderRow({ activity }: ActivityReminderRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 last:border-0" style={{ borderBottom: "1px solid rgba(180,100,90,0.08)" }}>
      {/* Status dot */}
      <div className="mt-1 shrink-0">
        {activity.reminderSent ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: "rgba(26,158,114,0.12)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1A9E72" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: "rgba(217,64,64,0.1)" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#D94040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full text-[#9A7A78]" style={{ background: "rgba(180,100,90,0.1)" }}>
            Activity Reminder
          </span>
          {activity.reminderSent ? (
            <span className="text-[10px] text-[#1A9E72]">Sent</span>
          ) : (
            <span className="text-[10px] text-[#D94040]">Scheduled</span>
          )}
        </div>
        <p className="text-sm font-medium text-[#1E0E0B] mt-1 truncate">{activity.reminderMessage || activity.title}</p>
        <p className="text-xs text-[#9A7A78] mt-0.5">
          {activity.reminderFireAt ? formatTs(activity.reminderFireAt) : "—"}
          {" · "}
          <span className="text-[#9A7A78]/70">{minutesLabel(activity.reminderMinutesBefore)} &quot;{activity.title}&quot;</span>
        </p>
      </div>
    </div>
  );
}

interface StandaloneNotificationRowProps {
  notification: TripNotification;
  onDelete: (id: string) => void;
  deleting: boolean;
}

function StandaloneNotificationRow({ notification, onDelete, deleting }: StandaloneNotificationRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 last:border-0" style={{ borderBottom: "1px solid rgba(180,100,90,0.08)" }}>
      {/* Status dot */}
      <div className="mt-1 shrink-0">
        {notification.sent ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: "rgba(26,158,114,0.12)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1A9E72" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: "rgba(59,111,202,0.12)" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full text-[#1A56DB]" style={{ background: "rgba(59,111,202,0.1)" }}>
            {TYPE_LABELS[notification.type]}
          </span>
          {notification.sent ? (
            <span className="text-[10px] text-[#1A9E72]">Sent</span>
          ) : (
            <span className="text-[10px] text-[#1A56DB]">Scheduled</span>
          )}
        </div>
        <p className="text-sm font-medium text-[#1E0E0B] mt-1 truncate">{notification.title}</p>
        <p className="text-xs text-[#9A7A78] mt-0.5">{notification.body}</p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(154,122,120,0.6)" }}>{formatTs(notification.scheduledFor)}</p>
      </div>

      {/* Delete */}
      {!notification.sent && (
        <button
          onClick={() => onDelete(notification.id)}
          disabled={deleting}
          className="shrink-0 mt-0.5 p-1 rounded-md transition-colors"
          style={{ color: "rgba(154,122,120,0.5)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#E74C3C"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(231,76,60,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(154,122,120,0.5)"; (e.currentTarget as HTMLButtonElement).style.background = ""; }}
          aria-label="Delete notification"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Add form ─────────────────────────────────────────────────────────────────

const EMPTY = { title: "", body: "", type: "general" as NotificationType, scheduledFor: "" };

interface AddFormProps {
  tripId: string;
  memberIds: string[];
  onSuccess: () => void;
  onCancel: () => void;
}

function AddNotificationForm({ tripId, memberIds, onSuccess, onCancel }: AddFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function field(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setError("");
    };
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.body.trim()) return setError("Body is required.");
    if (!form.scheduledFor) return setError("Scheduled time is required.");

    setSaving(true);
    try {
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        tripId,
        activityId: null,
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        scheduledFor: parseMadridDatetimeLocal(form.scheduledFor),
        sent: false,
        targetUserIds: memberIds,
        createdAt: serverTimestamp(),
      });
      setForm(EMPTY);
      onSuccess();
    } catch {
      setError("Failed to schedule notification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSend} className="mt-4 p-4 rounded-xl flex flex-col gap-4" style={{ background: "rgba(245,237,237,0.8)", border: "1px solid rgba(180,100,90,0.12)" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[#D94040] uppercase tracking-widest">New Notification</span>
        <button type="button" onClick={onCancel} className="text-[#9A7A78] hover:text-[#1E0E0B] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AField label="Title">
          <AInput placeholder="Your activity starts soon" value={form.title} onChange={field("title")} required />
        </AField>
        <AField label="Type">
          <ASelect value={form.type} onChange={field("type")}>
            <option value="general">General</option>
            <option value="upcoming_activity">Upcoming Activity</option>
            <option value="surprise">Surprise</option>
            <option value="schedule_change">Schedule Change</option>
          </ASelect>
        </AField>
      </div>

      <AField label="Message Body">
        <ATextarea rows={2} placeholder="Your message to the group…" value={form.body} onChange={field("body")} required />
      </AField>

      <AField label="Send At (Madrid time)">
        <AInput type="datetime-local" value={form.scheduledFor} onChange={field("scheduledFor")} required />
      </AField>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="gold" size="sm" loading={saving}>
          Schedule Notification
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {error && <span className="text-xs text-[#E74C3C]">{error}</span>}
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NotificationComposerProps {
  tripId: string;
  memberIds: string[];
  activities: Activity[];
}

export function NotificationComposer({ tripId, memberIds, activities }: NotificationComposerProps) {
  const [notifications, setNotifications] = useState<TripNotification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Subscribe to standalone notifications
  useEffect(() => {
    if (!tripId) return;
    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where("tripId", "==", tripId),
      orderBy("scheduledFor", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as TripNotification)));
      },
      (err) => console.warn("[Notifications] snapshot error:", err.code),
    );
    return unsub;
  }, [tripId]);

  // Activity reminders — filter from passed-in activities
  const activityReminders = activities
    .filter((a) => a.reminderEnabled && a.reminderFireAt)
    .sort((a, b) => (a.reminderFireAt?.toMillis() ?? 0) - (b.reminderFireAt?.toMillis() ?? 0));

  const totalCount = activityReminders.length + notifications.length;

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-[12px] bg-white p-5" style={{ border: "1px solid rgba(180,100,90,0.15)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BellIcon />
          <h2 className="font-display text-base font-semibold text-[#1E0E0B]">Notifications</h2>
          {totalCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-[#D94040]" style={{ background: "rgba(217,64,64,0.1)" }}>
              {totalCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#D94040] transition-colors px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(217,64,64,0.08)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Notification
        </button>
      </div>

      {/* Notification list */}
      {totalCount === 0 && !showForm ? (
        <div className="py-8 text-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(180,100,90,0.08)" }}>
            <BellIcon />
          </div>
          <p className="text-sm text-[#9A7A78]">No notifications scheduled yet.</p>
          <p className="text-xs mt-1" style={{ color: "rgba(154,122,120,0.6)" }}>Activity reminders and standalone notifications will appear here.</p>
        </div>
      ) : (
        <div>
          {/* Activity reminders section */}
          {activityReminders.length > 0 && (
            <div className="mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9A7A78] mb-1">
                Activity Reminders ({activityReminders.length})
              </p>
              <div>
                {activityReminders.map((a) => (
                  <ActivityReminderRow key={a.id} activity={a} />
                ))}
              </div>
            </div>
          )}

          {/* Standalone notifications section */}
          {notifications.length > 0 && (
            <div className={activityReminders.length > 0 ? "mt-3" : ""}>
              {activityReminders.length > 0 && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9A7A78] mb-1">
                  Standalone Notifications ({notifications.length})
                </p>
              )}
              <div>
                {notifications.map((n) => (
                  <StandaloneNotificationRow
                    key={n.id}
                    notification={n}
                    onDelete={handleDelete}
                    deleting={deletingId === n.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <AddNotificationForm
          tripId={tripId}
          memberIds={memberIds}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}
    </section>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D94040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
