"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminToken } from "@/lib/adminToken";
import { STATUS_LABEL } from "@/lib/format";
import { CONTACT_STATUSES, type ContactStatus } from "@/lib/types";
import { LockIcon } from "./ui";

/** Vikram's own notes, editable in place. Saves via POST /api/notes (admin token). */
export function NotesEditor({
  vcId,
  notes,
  history,
  status,
  lastContactDate,
}: {
  vcId: string;
  notes: string | null;
  history: string | null;
  status: ContactStatus;
  lastContactDate: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useAdminToken();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const [st, setSt] = useState<ContactStatus>(status);
  const [date, setDate] = useState(lastContactDate ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vcId, personalNotes: draft, contactStatus: st, lastContactDate: date || null }),
    });
    setSaving(false);
    if (res.status === 401) return setErr("Wrong or missing admin token");
    if (!res.ok) return setErr("Couldn't save. Try again.");
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="rounded-[20px] border border-dashed border-taupe p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="micro flex items-center gap-1.5">
            <LockIcon /> Vikram&apos;s notes
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="-my-2 -mr-2 rounded-full px-3 py-2 text-[12.5px] font-medium text-charcoal transition-colors duration-150 hover:bg-canvas hover:text-ink"
          >
            Edit
          </button>
        </div>
        {notes ? (
          <p className="whitespace-pre-line text-[13.5px] leading-[1.45] text-charcoal">{notes}</p>
        ) : (
          <p className="text-[13.5px] text-slate">No notes yet.</p>
        )}
        {history && <p className="mt-1 text-[12.5px] leading-[1.45] text-slate">{history}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-ink/20 bg-lifted p-4">
      <label className="micro mb-1.5 block" htmlFor={`notes-${vcId}`}>
        Vikram&apos;s notes
      </label>
      <textarea
        id={`notes-${vcId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        autoFocus
        data-lenis-prevent
        className="w-full resize-y rounded-[14px] border border-line bg-surface px-3 py-2.5 text-[14px] leading-[1.45] outline-none transition-[border-color] duration-150 focus:border-ink/40"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="micro mb-1 block">Status</span>
          <select
            value={st}
            onChange={(e) => setSt(e.target.value as ContactStatus)}
            className="h-10 w-full rounded-full border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-ink/40"
          >
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="micro mb-1 block">Last contact</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-full border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-ink/40"
          />
        </label>
      </div>
      {!token && (
        <label className="mt-3 block">
          <span className="micro mb-1 block">Admin token (asked once)</span>
          <input
            type="password"
            onChange={(e) => setToken(e.target.value)}
            className="h-10 w-full rounded-full border border-line bg-surface px-4 text-[13.5px] outline-none focus:border-ink/40"
            placeholder="ADMIN_TOKEN"
          />
        </label>
      )}
      {err && <p className="mt-2 text-[12.5px] text-bad">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn px-4 text-slate hover:text-ink">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving || !token} className="btn btn-ink disabled:opacity-50">
          {saving ? "Saving…" : "Save notes"}
        </button>
      </div>
    </div>
  );
}
