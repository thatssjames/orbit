import React, { useEffect, useState } from "react";
import { IconClipboard, IconPencil, IconUser, IconId, IconHash, IconCheck, IconX, IconCalendar } from "@tabler/icons-react";
import axios from "axios";
import { useRouter } from 'next/router';
import Confetti from "react-confetti";

type InformationPanelProps = {
  user: {
    userid: string;
    username: string;
    displayname: string;
    rank?: string | number;
    registered: boolean;
    birthdayDay?: number | null;
    birthdayMonth?: number | null;
    joinDate?: string | null;
  };
  isUser?: boolean;
  isAdmin?: boolean;
};

const monthNames = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function InformationPanel({ user, isUser, isAdmin }: InformationPanelProps) {
  const [editing, setEditing] = useState(false);
  const [month, setMonth] = useState(user.birthdayMonth ?? "");
  const [day, setDay] = useState(user.birthdayDay ?? "");
  const [loadedFromMembership, setLoadedFromMembership] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Attempt to derive workspace id from route: /workspace/[id]/...
  let workspaceId: string | null = null;
  if (router?.query?.id) {
    workspaceId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  } else if (typeof window !== 'undefined') {
    const match = window.location.pathname.match(/\/workspace\/([^/]+)/);
    if (match) workspaceId = match[1];
  }

  const canEdit = isUser || isAdmin;

  // Fetch membership-scoped birthday on mount (and when workspace/user changes)
  useEffect(() => {
    if (!workspaceId || !user?.userid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/workspace/${workspaceId}/birthday/${user.userid}`)
          .catch(() => axios.get(`/api/workspace/${workspaceId}/birthday`)); // fallback if viewing self
        if (cancelled) return;
        const { birthdayDay, birthdayMonth } = res.data;
        if (birthdayDay != null && birthdayMonth != null) {
          setDay(birthdayDay > 0 ? String(birthdayDay) : "");
          setMonth(birthdayMonth > 0 ? String(birthdayMonth) : "");
          // Mutate local user object reference to keep display consistent
          user.birthdayDay = birthdayDay;
          user.birthdayMonth = birthdayMonth;
        }
      } finally {
        if (!cancelled) setLoadedFromMembership(true);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, user?.userid]);

  const daysInMonth = (month: number) => {
    if (month === 2) return 28;
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  };
  const days =
    month && Number(month) > 0
      ? Array.from({ length: daysInMonth(Number(month)) }, (_, i) => i + 1)
      : [];

  const handleSave = async () => {
    if (!workspaceId) return; // workspace context required now
    setLoading(true);
    try {
      // If editing self use membership self endpoint; otherwise admin endpoint
      const isSelf = isUser || (user.userid && router.query?.userId === user.userid);
      if (isSelf) {
        await axios.post(`/api/workspace/${workspaceId}/birthday`, { day: Number(day), month: Number(month) });
      } else {
        await axios.put(`/api/workspace/${workspaceId}/birthday/${user.userid}`, { day: Number(day), month: Number(month) });
      }
      user.birthdayDay = Number(day);
      user.birthdayMonth = Number(month);
      setEditing(false);
    } finally {
      setLoading(false);
    }
  };

  // Compute birthday display from local state (authoritative after fetch)
  let birthday = "Not set";
  if (day && month) {
    const dNum = Number(day);
    const mNum = Number(month);
    if (dNum > 0 && mNum > 0) birthday = `${monthNames[mNum]} ${dNum}`;
  }

  const today = new Date();
  const isBirthday =
    user.birthdayDay === today.getDate() &&
    user.birthdayMonth === today.getMonth() + 1;

  return (
    <>
      {isBirthday && <Confetti />}
      <div className="bg-white dark:bg-zinc-700 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Information</h2>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center">
            <span className="inline-flex items-center font-semibold text-zinc-700 dark:text-white"><IconUser className="w-4 h-4 mr-2 text-primary" /> Username:</span>
            <span className="ml-2 text-zinc-900 dark:text-zinc-200">{user.username}</span>
          </div>
          <div className="flex items-center">
            <span className="inline-flex items-center font-semibold text-zinc-700 dark:text-white"><IconId className="w-4 h-4 mr-2 text-primary" /> Display Name:</span>
            <span className="ml-2 text-zinc-900 dark:text-zinc-200">{user.displayname}</span>
          </div>
          <div className="flex items-center">
            <span className="inline-flex items-center font-semibold text-zinc-700 dark:text-white"><IconHash className="w-4 h-4 mr-2 text-primary" /> UserId:</span>
            <span className="ml-2 text-zinc-900 dark:text-zinc-200">{user.userid}</span>
          </div>
          {user.joinDate && (
            <div className="flex items-center">
              <span className="inline-flex items-center font-semibold text-zinc-700 dark:text-white"><IconClipboard className="w-4 h-4 mr-2 text-primary" /> Joined:</span>
              <span className="ml-2 text-zinc-900 dark:text-zinc-200">{new Date(user.joinDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          <div className="flex items-center">
            <span className="inline-flex items-center font-semibold text-zinc-700 dark:text-white">
              {user.registered ? <IconCheck className="w-4 h-4 mr-2 text-primary" /> : <IconX className="w-4 h-4 mr-2 text-primary" />} Status:
            </span>
            <span className="ml-2 text-zinc-900 dark:text-zinc-200">{user.registered ? "Registered" : "Unregistered"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center font-semibold text-zinc-700 dark:text-white"><IconCalendar className="w-4 h-4 mr-2 text-primary" /> Birthday:</span>
            {!editing ? (
              <>
                <span className="text-zinc-900 dark:text-zinc-200">{birthday}</span>
                {canEdit && (
                  <button
                    className="ml-1 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600"
                    onClick={() => {
                      setEditing(true);
                      setMonth(user.birthdayMonth ?? "");
                      setDay(user.birthdayDay ?? "");
                    }}
                    aria-label="Edit Birthday"
                    type="button"
                  >
                    <IconPencil className="h-4 w-4 text-primary" />
                  </button>
                )}
              </>
            ) : (
              <>
                <select
                  value={month}
                  onChange={e => {
                    setMonth(e.target.value);
                    setDay("");
                  }}
                  className="border rounded px-2 py-1 w-32"
                >
                  <option value="">Month</option>
                  {monthNames.slice(1).map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={day}
                  onChange={e => setDay(e.target.value)}
                  className="border rounded px-2 py-1 w-20"
                  disabled={!month}
                >
                  <option value="">Day</option>
                  {days.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {workspaceId && (
                  <button
                    onClick={handleSave}
                    disabled={loading || !day || !month}
                    className="ml-2 bg-primary text-white px-3 py-1 rounded"
                  >
                    {loading ? "Saving..." : "Save"}
                  </button>
                )}
                <button
                  onClick={() => setEditing(false)}
                  className="ml-1 px-3 py-1 rounded border dark:text-white"
                  type="button"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default InformationPanel;