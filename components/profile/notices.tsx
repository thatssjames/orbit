import React, { useState } from "react";
import { FC } from "@/types/settingsComponent";
import moment from "moment";
import { IconCheck, IconX, IconClock } from "@tabler/icons-react";
import { useRouter } from "next/router";
import axios from "axios";
import toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";

interface Props {
  notices: any[];
}

const Notices: FC<Props> = ({ notices }) => {
  const router = useRouter();
  const [workspace] = useRecoilState(workspacestate);
  const [localNotices, setLocalNotices] = useState<any[]>(notices || []);

  const getStatusIcon = (notice: any) => {
    if (notice.approved)
      return (
        <IconCheck className="w-5 h-5 text-green-500 dark:text-green-400" />
      );
    if (notice.reviewed)
      return <IconX className="w-5 h-5 text-red-500 dark:text-red-400" />;
    if (notice.revoked)
      return <IconX className="w-5 h-5 text-red-500 dark:text-red-400" />;
    return (
      <IconClock className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
    );
  };

  const getStatusText = (notice: any) => {
    if (notice.approved) return "Approved";
    if (notice.revoked) return "Revoked";
    if (notice.reviewed) return "Declined";
    return "Under Review";
  };

  return (
    <div className="bg-white dark:bg-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <div className="p-6">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
          Inactivity Notices
        </h2>
        {localNotices.filter((n) => !n.reviewed).length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md flex items-center justify-between">
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              {localNotices.filter((n) => !n.reviewed).length} pending notice(s)
              for this user
            </div>
            <div>
              <button
                onClick={() =>
                  router.push(`/workspace/${router.query.id}/notices`)
                }
                className="px-3 py-1 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-md text-sm"
              >
                Manage
              </button>
            </div>
          </div>
        )}

        {localNotices.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
            No inactivity notices found.
          </p>
        ) : (
          <div className="space-y-4">
            {localNotices.map((notice: any) => {
              const now = new Date();
              const isActive =
                notice.approved &&
                notice.startTime &&
                notice.endTime &&
                new Date(notice.startTime) <= now &&
                new Date(notice.endTime) >= now;
              return (
                <div
                  key={notice.id}
                  className="flex gap-4 p-4 bg-zinc-50 dark:bg-zinc-700 rounded-lg"
                >
                  <div className="flex-shrink-0">{getStatusIcon(notice)}</div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium ${
                          notice.approved
                            ? "text-green-600 dark:text-green-400"
                            : notice.reviewed
                            ? "text-red-600 dark:text-red-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        }`}
                      >
                        {getStatusText(notice)}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-300">
                        {moment(notice.startTime).format("DD MMM YYYY")} -{" "}
                        {moment(notice.endTime).format("DD MMM YYYY")}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      {notice.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <button
                        onClick={async () => {
                          try {
                            const workspaceId =
                              router.query.id ?? workspace.groupId;
                            await axios.post(
                              `/api/workspace/${workspaceId}/activity/notices/update`,
                              {
                                id: notice.id,
                                status: "cancel",
                              }
                            );
                            setLocalNotices((prev) =>
                              prev.filter((n) => n.id !== notice.id)
                            );
                            toast.success("Notice revoked");
                          } catch (e) {
                            console.error(e);
                            toast.error("Failed to revoke notice");
                          }
                        }}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded-md text-sm"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default Notices;