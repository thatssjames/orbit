import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Button from "@/components/button";
import Workspace from "@/layouts/workspace";
import {
  IconChevronRight,
  IconChevronLeft,
  IconCalendarEvent,
  IconPlus,
  IconTrash,
  IconArrowLeft,
  IconEdit,
  IconUsers,
  IconClock,
  IconUserCircle,
} from "@tabler/icons-react";
import prisma, { Session, user, SessionType } from "@/utils/database";
import { useRecoilState } from "recoil";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import randomText from "@/utils/randomText";
import { useState, useMemo, useEffect } from "react";
import { useSessionColors } from "@/hooks/useSessionColors";
import axios from "axios";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import toast, { Toaster } from "react-hot-toast";
import SessionTemplate from "@/components/sessionpreview";

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

function getRandomBg(userid: string | number) {
  const str = String(userid);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

export const getServerSideProps = withPermissionCheckSsr(
  async ({ query, req }) => {
    const currentDate = new Date();
    const monday = new Date(currentDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const allSessions = await prisma.session.findMany({
      where: {
        sessionType: {
          workspaceGroupId: parseInt(query.id as string),
        },
      },
      include: {
        owner: true,
        sessionType: true,
        users: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    let userSessionMetrics = null;
    if (req.session?.userid) {
      const userId = BigInt(req.session.userid);
      const lastReset = await prisma.activityReset.findFirst({
        where: {
          workspaceGroupId: parseInt(query.id as string),
        },
        orderBy: {
          resetAt: "desc",
        },
      });

      const startDate = lastReset?.resetAt || new Date("2025-01-01");
      const ownedSessions = await prisma.session.findMany({
        where: {
          ownerId: userId,
          sessionType: {
            workspaceGroupId: parseInt(query.id as string),
          },
          date: {
            gte: startDate,
            lte: currentDate,
          },
        },
      });

      const allSessionParticipations = await prisma.sessionUser.findMany({
        where: {
          userid: userId,
          session: {
            sessionType: {
              workspaceGroupId: parseInt(query.id as string),
            },
            date: {
              gte: startDate,
              lte: currentDate,
            },
          },
        },
        include: {
          session: {
            select: {
              id: true,
              sessionType: {
                select: {
                  slots: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const roleBasedHostedSessions = allSessionParticipations.filter(
        (participation) => {
          const slots = participation.session.sessionType.slots as any[];
          const slotIndex = participation.slot;
          const slotName = slots[slotIndex]?.name || "";
          return (
            participation.roleID.toLowerCase().includes("host") ||
            participation.roleID.toLowerCase().includes("co-host") ||
            slotName.toLowerCase().includes("host") ||
            slotName.toLowerCase().includes("co-host")
          );
        }
      ).length;

      const sessionsHosted = ownedSessions.length + roleBasedHostedSessions;
      const ownedSessionIds = new Set(ownedSessions.map((s) => s.id));
      const sessionsAttended = allSessionParticipations.filter(
        (participation) => {
          const slots = participation.session.sessionType.slots as any[];
          const slotIndex = participation.slot;
          const slotName = slots[slotIndex]?.name || "";
          const isHosting =
            participation.roleID.toLowerCase().includes("host") ||
            participation.roleID.toLowerCase().includes("co-host") ||
            slotName.toLowerCase().includes("host") ||
            slotName.toLowerCase().includes("co-host");

          return !isHosting && !ownedSessionIds.has(participation.sessionid);
        }
      ).length;

      userSessionMetrics = {
        sessionsHosted,
        sessionsAttended,
      };
    }

    return {
      props: {
        allSessions: JSON.parse(
          JSON.stringify(allSessions, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ) as typeof allSessions,
        userSessionMetrics,
      },
    };
  }
);

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const getWeekDates = (monday: Date): Date[] => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
};

const WeeklyCalendar: React.FC<{
  currentWeek: Date;
  sessions: (Session & {
    owner: user;
    sessionType: SessionType;
    users?: ({
      user: user;
    } & {
      userid: bigint;
      sessionid: string;
      roleID: string;
      slot: number;
    })[];
  })[];
  canManage?: boolean;
  onEditSession?: (sessionId: string) => void;
  onSessionClick?: (session: any) => void;
  workspaceId?: string | number;
  onWeekChange?: (newWeek: Date) => void;
  canCreateSession?: boolean;
  onCreateSession?: () => void;
}> = ({
  currentWeek,
  sessions,
  canManage,
  onEditSession,
  onSessionClick,
  workspaceId,
  onWeekChange,
  canCreateSession,
  onCreateSession,
}) => {
  const { getSessionTypeColor, getRecurringColor, getTextColorForBackground } =
    useSessionColors(workspaceId);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    const monday = getMonday(currentWeek);
    const weekDates = getWeekDates(monday);
    const todayInWeek = weekDates.find(
      (date) => date.toDateString() === today.toDateString()
    );

    return todayInWeek || weekDates[0];
  });

  const monday = getMonday(currentWeek);
  const weekDates = getWeekDates(monday);
  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const dayNamesShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const sessionsByDate = sessions.reduce(
    (acc: { [key: string]: any[] }, session) => {
      const sessionDate = new Date(session.date);
      const localDateKey = sessionDate.toLocaleDateString();
      if (!acc[localDateKey]) {
        acc[localDateKey] = [];
      }
      acc[localDateKey].push(session);
      return acc;
    },
    {}
  );

  const selectedDateSessions =
    sessionsByDate[selectedDate.toLocaleDateString()] || [];
  useEffect(() => {
    const newWeekDates = getWeekDates(getMonday(currentWeek));
    const today = new Date();
    const todayInNewWeek = newWeekDates.find(
      (date) => date.toDateString() === today.toDateString()
    );

    if (todayInNewWeek) {
      setSelectedDate(todayInNewWeek);
    } else {
      setSelectedDate(newWeekDates[0]);
    }
  }, [currentWeek]);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 gap-3">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              const previousWeek = new Date(currentWeek);
              previousWeek.setDate(currentWeek.getDate() - 7);
              onWeekChange?.(previousWeek);
            }}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            <IconChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 min-w-[120px] text-center">
            {(() => {
              const monday = getMonday(currentWeek);
              const sunday = new Date(monday);
              sunday.setDate(monday.getDate() + 6);
              return `${monday.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}`;
            })()}
          </span>
          <button
            onClick={() => {
              const nextWeek = new Date(currentWeek);
              nextWeek.setDate(currentWeek.getDate() + 7);
              onWeekChange?.(nextWeek);
            }}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              const today = new Date();
              onWeekChange?.(today);
              setSelectedDate(today);
            }}
            className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
          >
            Today
          </button>

          {canCreateSession && onCreateSession && (
            <button
              onClick={onCreateSession}
              className="inline-flex items-center justify-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              <IconPlus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Session</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
        {weekDates.map((date, index) => {
          const isToday = date.toDateString() === new Date().toDateString();
          const isSelected =
            date.toDateString() === selectedDate.toDateString();
          const daySessionCount = (
            sessionsByDate[date.toLocaleDateString()] || []
          ).length;

          return (
            <button
              key={date.toDateString()}
              onClick={() => setSelectedDate(date)}
              className={`p-3 text-center border-r border-zinc-200 dark:border-zinc-700 last:border-r-0 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/50 ${
                isSelected
                  ? "bg-primary/10 text-primary dark:bg-primary/20"
                  : isToday
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <div className="text-xs font-medium mb-1">
                <span className="hidden xl:inline">{dayNames[index]}</span>
                <span className="xl:hidden">{dayNamesShort[index]}</span>
              </div>
              <div
                className={`text-lg font-bold mb-1 ${
                  isSelected
                    ? "text-primary"
                    : isToday
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-900 dark:text-white"
                }`}
              >
                {date.getDate()}
              </div>
              <div
                className={`w-2 h-2 rounded-full mx-auto ${
                  daySessionCount > 0
                    ? isSelected
                      ? "bg-primary"
                      : isToday
                      ? "bg-blue-500"
                      : "bg-zinc-400"
                    : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {selectedDateSessions.length} session
              {selectedDateSessions.length !== 1 ? "s" : ""} scheduled
            </p>
          </div>
        </div>

        {selectedDateSessions.length > 0 ? (
          <div className="h-64 overflow-y-auto space-y-3 pr-2">
            {selectedDateSessions
              .sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              )
              .map((session: any) => {
                const isRecurring = session.scheduleId !== null;
                const now = new Date();
                const sessionStart = new Date(session.date);
                const sessionDuration = session.duration || 30;
                const sessionEnd = new Date(
                  sessionStart.getTime() + sessionDuration * 60 * 1000
                );
                const isActive = now >= sessionStart && now <= sessionEnd;
                const isConcluded = now > sessionEnd;
                const coHost = session.users?.find((user: any) => {
                  if (user.roleID?.toLowerCase().includes("co-host"))
                    return true;
                  const slots = session.sessionType?.slots || [];
                  const userSlot = slots[user.slot];
                  if (userSlot?.name?.toLowerCase().includes("co-host"))
                    return true;
                  return false;
                });

                const participantCount =
                  session.users?.filter((user: any) => {
                    if (user.roleID?.toLowerCase().includes("co-host"))
                      return false;
                    const slots = session.sessionType?.slots || [];
                    const userSlot = slots[user.slot];
                    if (userSlot?.name?.toLowerCase().includes("co-host"))
                      return false;
                    return true;
                  }).length || 0;

                return (
                  <div
                    key={session.id}
                    className={`rounded-lg p-4 cursor-pointer transition-all group ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-400 dark:border-emerald-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] dark:shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                        : "bg-zinc-50 dark:bg-zinc-700/50 border-2 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                    onClick={() => onSessionClick?.(session)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-zinc-900 dark:text-white truncate">
                            {session.name || session.sessionType.name}
                          </h4>
                          {isActive && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 animate-pulse">
                              • LIVE
                            </span>
                          )}
                          {session.type && (
                            <span
                              className={`${getSessionTypeColor(
                                session.type
                              )} ${getTextColorForBackground(
                                getSessionTypeColor(session.type)
                              )} px-2 py-1 rounded text-xs font-medium`}
                            >
                              {session.type.charAt(0).toUpperCase() +
                                session.type.slice(1)}
                            </span>
                          )}
                          {isConcluded && (
                            <span className="bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 px-2 py-1 rounded text-xs font-medium">
                              Concluded
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                          <div className="flex items-center gap-1">
                            <IconClock className="w-4 h-4" />
                            {new Date(session.date).toLocaleTimeString(
                              undefined,
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              }
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <IconUserCircle className="w-4 h-4" />
                            {session.owner?.username || "Unclaimed"}
                          </div>
                          {participantCount > 0 && (
                            <div className="flex items-center gap-1">
                              <IconUsers className="w-4 h-4" />
                              {participantCount} participant
                              {participantCount !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex items-center gap-1">
                          {session.owner && (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${getRandomBg(
                                session.owner.userid
                              )}`}
                            >
                              <img
                                src={
                                  session.owner.picture || "/default-avatar.png"
                                }
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "/default-avatar.png";
                                }}
                              />
                            </div>
                          )}

                          {coHost && (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${getRandomBg(
                                coHost.user.userid
                              )} ${session.owner ? "-ml-2" : ""}`}
                            >
                              <img
                                src={
                                  coHost.user.picture || "/default-avatar.png"
                                }
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "/default-avatar.png";
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {canManage && onEditSession && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSession(session.id);
                            }}
                            className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-zinc-800 text-zinc-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-600"
                            title="Edit session"
                          >
                            <IconEdit className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-zinc-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-4">
                <IconCalendarEvent className="w-6 h-6 text-zinc-400" />
              </div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                No Sessions Scheduled
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                There are no sessions scheduled for this date
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

type pageProps = {
  allSessions: (Session & {
    owner: user;
    sessionType: SessionType;
    users: ({
      user: user;
    } & {
      userid: bigint;
      sessionid: string;
      roleID: string;
      slot: number;
    })[];
  })[];
  userSessionMetrics: {
    sessionsHosted: number;
    sessionsAttended: number;
  } | null;
};

const Home: pageWithLayout<pageProps> = (props) => {
  const [login, setLogin] = useRecoilState(loginState);
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [allSessions, setAllSessions] = useState<any[]>(props.allSessions);
  const [loading, setLoading] = useState(false);
  const text = useMemo(() => randomText(login.displayname), []);
  const [statues, setStatues] = useState(new Map<string, string>());
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const router = useRouter();
  const { userSessionMetrics } = props;

  const handleEditSession = (sessionId: string) => {
    router.push(`/workspace/${router.query.id}/sessions/edit/${sessionId}`);
  };

  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleDeleteSession = async (sessionId: string, deleteAll = false) => {
    try {
      await axios.delete(
        `/api/workspace/${router.query.id}/sessions/${sessionId}/delete`,
        {
          data: { deleteAll },
        }
      );

      if (deleteAll) {
        const session = allSessions.find((s) => s.id === sessionId);
        if (session?.scheduleId) {
          toast.success("All sessions in series deleted successfully");
          setAllSessions(
            allSessions.filter((s) => s.scheduleId !== session.scheduleId)
          );
        }
      } else {
        toast.success("Session deleted successfully");
        setAllSessions(allSessions.filter((s) => s.id !== sessionId));
      }
      await loadAllSessions();
    } catch (error: any) {
      console.error("Delete session error:", error);
      toast.error(error?.response?.data?.error || "Failed to delete session");
    }
  };

  const loadAllSessions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/workspace/${router.query.id}/sessions/all`
      );
      setAllSessions(response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to load sessions:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSessions();
  }, [router.query.id]);
  useEffect(() => {
    if (router.query.refresh === "true") {
      loadAllSessions();
      router.replace(`/workspace/${router.query.id}/sessions`, undefined, {
        shallow: true,
      });
    }
  }, [router.query.refresh]);

  const refreshAllSessions = () => {
    loadAllSessions();
  };

  const loadWorkspaceMembers = async () => {
    try {
      const response = await axios.get(
        `/api/workspace/${router.query.id}/users`
      );
      setWorkspaceMembers(response.data);
    } catch (error) {
      console.error("Failed to load workspace members:", error);
    }
  };

  useEffect(() => {
    if (router.query.id) {
      loadWorkspaceMembers();
    }
  }, [router.query.id]);

  const endSession = async (id: string) => {
    const axiosPromise = axios.delete(
      `/api/workspace/${router.query.id}/sessions/manage/${id}/end`,
      {}
    );

    toast.promise(axiosPromise, {
      loading: "Ending session...",
      success: () => {
        loadAllSessions();
        return "Session ended successfully";
      },
      error: "Failed to end session",
    });
  };

  useEffect(() => {
    const getAllStatues = async () => {
      const newStatues = new Map<string, string>();
      for (const session of allSessions) {
        for (const e of session.sessionType.statues.sort((a: any, b: any) => {
          const object = JSON.parse(JSON.stringify(a));
          const object2 = JSON.parse(JSON.stringify(b));
          return object2.timeAfter - object.timeAfter;
        })) {
          const minutes =
            (new Date().getTime() - new Date(session.date).getTime()) /
            1000 /
            60;
          const slot = JSON.parse(JSON.stringify(e));
          if (slot.timeAfter < minutes) {
            newStatues.set(session.id, slot.name);
            break;
          }
        }
        if (!newStatues.has(session.id)) {
          newStatues.set(session.id, "Open");
        }
      }
      setStatues(newStatues);
    };

    getAllStatues();
    const interval = setInterval(getAllStatues, 10000);

    return () => clearInterval(interval);
  }, [allSessions]);

  return (
    <div className="pagePadding">
      <Toaster position="bottom-center" />
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-medium text-zinc-900 dark:text-white">
              Sessions
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Plan, schedule, and manage sessions for your staff members
            </p>
          </div>
        </div>

        <div className="mb-8">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b dark:border-zinc-700">
              <div className="bg-primary/10 p-2 rounded-lg">
                <IconCalendarEvent className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                  Weekly Schedule
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  View scheduled sessions for the week
                </p>
              </div>
            </div>
            <div className="p-4">
              <WeeklyCalendar
                currentWeek={currentWeek}
                sessions={allSessions}
                canManage={workspace.yourPermission?.includes(
                  "manage_sessions"
                )}
                onEditSession={handleEditSession}
                onSessionClick={handleSessionClick}
                workspaceId={
                  Array.isArray(router.query.id)
                    ? router.query.id[0]
                    : router.query.id
                }
                onWeekChange={(newWeek) => setCurrentWeek(newWeek)}
                canCreateSession={workspace.yourPermission?.includes(
                  "manage_sessions"
                )}
                onCreateSession={() =>
                  router.push(`/workspace/${router.query.id}/sessions/new`)
                }
              />
            </div>
          </div>
        </div>

        {selectedSession && (
          <SessionTemplate
            session={selectedSession}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedSession(null);
            }}
            onEdit={handleEditSession}
            onDelete={handleDeleteSession}
            onUpdate={async () => {
              const freshSessions = await loadAllSessions();
              if (freshSessions && selectedSession) {
                const updatedSession = freshSessions.find(
                  (s: any) => s.id === selectedSession.id
                );
                if (updatedSession) {
                  setSelectedSession(updatedSession);
                }
              }
            }}
            workspaceMembers={workspaceMembers}
            canManage={workspace.yourPermission?.includes("manage_sessions")}
          />
        )}
      </div>
    </div>
  );
};

Home.layout = Workspace;

export default Home;
