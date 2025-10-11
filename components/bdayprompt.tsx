import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface WorkspaceBirthdayPromptProps {
  workspaceId: number | string;
  visible?: boolean;
}

export const WorkspaceBirthdayPrompt: React.FC<WorkspaceBirthdayPromptProps> = ({ workspaceId, visible }) => {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/workspace/${workspaceId}/birthday`);
        if (cancelled) return;
        const { birthdayDay, birthdayMonth } = res.data;
        const skipped = birthdayDay === 0 && birthdayMonth === 0;
        const needs = !skipped && (birthdayDay == null || birthdayMonth == null);
        setOpen(needs && (visible ?? true));
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setInitialLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, visible]);

  const daysInMonth = (m: number) => {
    if (m === 2) return 28;
    if ([4,6,9,11].includes(m)) return 30;
    return 31;
  };

  const months = [
    { name: 'January', value: 1 }, { name: 'February', value: 2 }, { name: 'March', value: 3 },
    { name: 'April', value: 4 }, { name: 'May', value: 5 }, { name: 'June', value: 6 },
    { name: 'July', value: 7 }, { name: 'August', value: 8 }, { name: 'September', value: 9 },
    { name: 'October', value: 10 }, { name: 'November', value: 11 }, { name: 'December', value: 12 }
  ];

  const days = month ? Array.from({ length: daysInMonth(Number(month)) }, (_, i) => i + 1) : [];

  const save = async (skip = false) => {
    setLoading(true);
    try {
      if (skip) {
        await axios.post(`/api/workspace/${workspaceId}/birthday`, { day: 0, month: 0 });
      } else {
        await axios.post(`/api/workspace/${workspaceId}/birthday`, { day: Number(day), month: Number(month) });
      }
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !initialLoaded) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-lg min-w-[300px]">
        <h2 className="text-lg font-bold dark:text-white mb-2">🎂 Set your birthday</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">You can skip if you prefer not to share.</p>
        <div className="flex gap-2 mb-4">
          <select
            value={month}
            onChange={e => { setMonth(e.target.value); setDay(''); }}
            className="border rounded px-2 py-1 w-32"
          >
            <option value="">Month</option>
            {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
          </select>
          <select
            value={day}
            onChange={e => setDay(e.target.value)}
            className="border rounded px-2 py-1 w-20"
            disabled={!month}
          >
            <option value="">Day</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => save(false)}
            disabled={loading || !day || !month}
            className="bg-orbit text-white px-4 py-2 rounded"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => save(true)}
            disabled={loading}
            className="bg-zinc-300 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-4 py-2 rounded"
            type="button"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceBirthdayPrompt;