import axios from 'axios';
import React, { useEffect, useState, Fragment } from 'react';
import { workspacestate } from '@/state';
import { useRecoilState } from 'recoil';
import { IconSearch, IconRefresh, IconFilter } from '@tabler/icons-react';
import { Popover, Transition } from '@headlessui/react';
import { FC } from '@/types/settingsComponent';

type AuditEntry = {
  id: number;
  userId?: string;
  userName?: string;
  action: string;
  entity?: string;
  details?: any;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  'document.create': 'Document Create',
  'document.update': 'Document Update',
  'document.delete': 'Document Delete',
  'session.create': 'Session Create',
  'session.delete': 'Session Delete',
  'wall.post.delete': 'Wall Delete',
  'wall.post.create': 'Wall Create',
};

const getActionLabel = (action: string) => {
  if (!action) return '';
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .split(/[._]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
};

const formatValue = (v: any) => {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};

const itemKey = (x: any) => {
  if (x === null || x === undefined) return String(x);
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (typeof x === 'object') {
    if (x.id) return String(x.id);
    if (x.name) return String(x.name);
    return JSON.stringify(x);
  }
  return String(x);
};

const renderDetails = (details: any, action?: string) => {
  if (!details) return <span className="text-xs text-zinc-500">—</span>;
  if (typeof details === 'string' || typeof details === 'number') {
    return <div className="text-xs font-mono whitespace-pre-wrap">{String(details)}</div>;
  }

  const hasBefore = Object.prototype.hasOwnProperty.call(details, 'before');
  const hasAfter = Object.prototype.hasOwnProperty.call(details, 'after');
  if (hasBefore || hasAfter) {
    try {
      const before = details.before || {};
      const after = details.after || {};
      if (Array.isArray(before.widgets) || Array.isArray(after.widgets)) {
        const b = Array.isArray(before.widgets) ? before.widgets : [];
        const a = Array.isArray(after.widgets) ? after.widgets : [];
        const bKeys = b.map(itemKey);
        const aKeys = a.map(itemKey);
        const added = a.filter((x: any) => !bKeys.includes(itemKey(x)));
        const removed = b.filter((x: any) => !aKeys.includes(itemKey(x)));
        return (
          <div className="text-xs">
            {added.length > 0 && (
              <div className="mb-1">
                <div className="text-[10px] text-zinc-500">Widgets added</div>
                <div className="text-xs bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-2 rounded-md overflow-x-auto font-mono">{added.map(itemKey).join(', ')}</div>
              </div>
            )}
            {removed.length > 0 && (
              <div>
                <div className="text-[10px] text-zinc-500">Widgets removed</div>
                <div className="text-xs bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-2 rounded-md overflow-x-auto font-mono">{removed.map(itemKey).join(', ')}</div>
              </div>
            )}
            {added.length === 0 && removed.length === 0 && (
              <div className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-2 rounded-md overflow-x-auto font-mono">{formatValue({ before: before.widgets, after: after.widgets })}</div>
            )}
          </div>
        );
      }
    } catch (e) {
      // maybe console logs
    }
    if (action && action.startsWith('document.update')) {
      const before = details.before || {};
      const after = details.after || {};
      const changes: any[] = [];
      const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
      for (const k of keys) {
        const bv = before[k];
        const av = after[k];
        if (JSON.stringify(bv) === JSON.stringify(av)) continue;
        if (k === 'name' || k === 'title') {
          changes.push({ key: k, before: String(bv || ''), after: String(av || '') });
        } else if (k === 'content' || k === 'body') {
          changes.push({ key: k, before: String(bv || '').slice(0, 300), after: String(av || '').slice(0, 300), isContent: true });
        } else if (Array.isArray(bv) || Array.isArray(av)) {
          const bArr = Array.isArray(bv) ? bv : [];
          const aArr = Array.isArray(av) ? av : [];
          changes.push({ key: k, before: bArr.length ? bArr.join(', ') : 'None', after: aArr.length ? aArr.join(', ') : 'None' });
        } else {
          changes.push({ key: k, before: formatValue(bv), after: formatValue(av) });
        }
      }

      if (changes.length > 0) {
        return (
          <div className="text-xs">
            {changes.map((c) => (
              <div key={c.key} className="mb-2">
                <div className="text-[10px] text-zinc-500">{c.key}</div>
                {c.isContent ? (
                  <>
                    <div className="text-[10px] text-zinc-500">After (preview)</div>
                    <pre className="text-xs bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-2 rounded-md overflow-x-auto font-mono">{c.after}</pre>
                    <div className="text-[10px] text-zinc-500">Before (preview)</div>
                    <pre className="text-xs bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-2 rounded-md overflow-x-auto font-mono">{c.before}</pre>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] text-zinc-500">After</div>
                    <div className="text-xs bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-2 rounded-md overflow-x-auto font-mono">{c.after}</div>
                    <div className="text-[10px] text-zinc-500">Before</div>
                    <div className="text-xs bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-2 rounded-md overflow-x-auto font-mono">{c.before}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        );
      }
    }

    return (
      <div className="text-xs">
        {hasAfter && (
          <div className="mb-1">
            <div className="text-[10px] text-zinc-500">After</div>
            <pre className="text-xs bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-2 rounded-md overflow-x-auto font-mono">{formatValue(details.after)}</pre>
          </div>
        )}
        {hasBefore && (
          <div>
            <div className="text-[10px] text-zinc-500">Before</div>
            <pre className="text-xs bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-2 rounded-md overflow-x-auto font-mono">{formatValue(details.before)}</pre>
          </div>
        )}
      </div>
    );
  }

  if (typeof details === 'object') {
    return (
      <div className="text-xs">
        {Object.keys(details).map((k) => (
          <div key={k} className="mb-1">
            <div className="text-[10px] text-zinc-500">{k}</div>
            <pre className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-2 rounded-md overflow-x-auto font-mono">{formatValue(details[k])}</pre>
          </div>
        ))}
      </div>
    );
  }

  return <pre className="text-xs font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-2 rounded-md">{String(details)}</pre>;
};
const AuditLogs: FC<{ triggerToast?: any }> = () => {
  const [workspace] = useRecoilState(workspacestate);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (actionFilter === 'session.create') {
        params.search = (search ? search + ' ' : '') + 'session.create';
      } else if (actionFilter) {
        params.action = actionFilter;
        if (search) params.search = search;
      } else if (search) {
        params.search = search;
      }

      const res = await axios.get(`/api/workspace/${workspace.groupId}/audit`, { params });
      if (res.data?.success) {
        setRows(res.data.rows || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // finish later
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <IconSearch className="w-4 h-4 text-zinc-400 dark:text-white" />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search details"
              className="flex-1 md:w-50 p-2 pl-10 border rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={fetch} title="Refresh" className="p-2 rounded-md bg-zinc-50 dark:bg-zinc-700 text-zinc-700 dark:text-white">
              <IconRefresh />
            </button>
          </div>
        </div>
        <div className="flex items-center">
          <Popover className="relative">
            {({ open, close }) => (
              <>
                <Popover.Button className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${open ? 'bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white ring-2 ring-[#ff0099]/50' : 'bg-zinc-50 dark:bg-zinc-700/50 border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white'}`}>
                  <IconFilter className="w-4 h-4" />
                  <span className="text-sm">{actionFilter ? (ACTION_LABELS[actionFilter] || getActionLabel(actionFilter)) : 'Filters'}</span>
                </Popover.Button>

                <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                  <Popover.Panel className="absolute z-50 mt-2 w-42 max-w-[90vw] origin-top-right right-0 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xl p-2 top-full max-h-[60vh] overflow-auto">
                    <div className="space-y-1">
                      <button onClick={() => { setActionFilter(''); setSearch(''); fetch(); close(); }} className="w-full text-left px-3 py-2 rounded-md text-sm text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700">All actions</button>
                      {Object.keys(ACTION_LABELS).map((k) => (
                        <button key={k} onClick={() => { setActionFilter(k); fetch(); close(); }} className="w-full text-left px-3 py-2 rounded-md text-sm text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700">{ACTION_LABELS[k]}</button>
                      ))}
                    </div>
                  </Popover.Panel>
                </Transition>
              </>
            )}
          </Popover>
        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-zinc-800 rounded-lg p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-700">
              <th className="p-2">Time</th>
              <th className="p-2">User</th>
              <th className="p-2">Action</th>
              <th className="p-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="p-2 dark:text-white">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} className="p-2 dark:text-white">No audit entries</td></tr>
            )}
            {rows.map((r) => {
              const details = r.details || {};
              return (
                <tr key={r.id} className="border-t bg-white dark:bg-zinc-800 dark:text-white">
                  <td className="p-2 text-xs" title={new Date(r.createdAt).toUTCString()}>{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-2">{r.userName || r.userId || 'System'}</td>
                  <td className="p-2">{getActionLabel(r.action)}</td>
                  <td className="p-2">
                    {renderDetails(details, r.action)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

AuditLogs.title = 'Audit Logs';

export default AuditLogs;
