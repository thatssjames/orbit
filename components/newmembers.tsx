import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { IconUserPlus } from '@tabler/icons-react';

interface NewMember {
  userid: string;
  username: string;
  picture?: string | null;
  joinDate: string;
}

const BG_COLORS = [
  "bg-red-200",
  "bg-green-200",
  "bg-blue-200",
  "bg-yellow-200",
  "bg-pink-200",
  "bg-indigo-200",
  "bg-teal-200",
  "bg-orange-200",
];

function getRandomBg(userid: string) {
  let hash = 0;
  for (let i = 0; i < userid.length; i++) {
    hash = userid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

export default function NewToTeam() {
  const router = useRouter();
  const { id: workspaceId } = router.query;
  const [members, setMembers] = useState<NewMember[]>([]);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    axios.get(`/api/workspace/${workspaceId}/home/new-members?days=7`).then(r => {
      if (r.status === 200 && r.data.success) {
        setMembers(r.data.members || []);
      }
    }).finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return null;
  if (!members.length) return null;

  return (
    <div ref={cardRef} className="z-0 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl shadow-sm p-4 flex flex-col gap-4 mb-6 relative">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <IconUserPlus className="w-5 h-5 text-primary" />
        </div>
        <span className="text-lg font-medium text-zinc-900 dark:text-white">New to the Team</span>
      </div>
      <div className="overflow-x-auto overflow-y-hidden">
        <div className="flex gap-6 pb-2 min-w-max">
          {members.map(m => (
            <div key={m.userid} className="flex flex-col items-center shrink-0 w-20">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getRandomBg(m.userid)} ring-2 ring-transparent hover:ring-primary transition overflow-hidden`}>
                <img
                  src={m.picture || '/default-avatar.jpg'}
                  alt={m.username}
                  className="w-16 h-16 object-cover rounded-full border-2 border-white"
                  loading="lazy"
                />
              </div>
              <div className="mt-2 text-xs font-medium text-center text-zinc-700 dark:text-zinc-300 truncate w-full" title={m.username}>
                {m.username}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
