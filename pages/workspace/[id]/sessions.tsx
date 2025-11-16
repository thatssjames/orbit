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
import SessionTemplate from "@/components/sessioncard";

const BG_COLORS = [
  "bg-rose-200",
  "bg-lime-200",
  "bg-sky-200",
  "bg-amber-200",
  "bg-violet-200",
  "bg-fuchsia-200",
  "bg-emerald-200",
  "bg-indigo-200",
  "bg-pink-200",
  "bg-cyan-200",
  "bg-red-200",
  "bg-green-200",
  "bg-blue-200",
  "bg-yellow-200",
  "bg-teal-200",
  "bg-orange-200",
];

function getRandomBg(userid: any, username?: any) {
  const idStr = String(userid ?? "");
  const nameStr = String(username ?? "");
  const key = `${idStr}:${nameStr}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  const index = (hash >>> 0) % BG_COLORS.length;
  return BG_COLORS[index];
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
  selectedDateProp?: Date;
  onSelectedDateChange?: (d: Date) => void;
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
  selectedDateProp,
  onSelectedDateChange,
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

    return selectedDateProp || todayInWeek || weekDates[0];
  });

  useEffect(() => {
    if (selectedDateProp) {
      setSelectedDate(new Date(selectedDateProp));
    }
  }, [selectedDateProp]);

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

    if (selectedDateProp) {
      return;
    }

    if (todayInNewWeek) {
      setSelectedDate(todayInNewWeek);
      onSelectedDateChange?.(todayInNewWeek);
    } else {
      setSelectedDate(newWeekDates[0]);
      onSelectedDateChange?.(newWeekDates[0]);
    }
  }, [currentWeek]);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 gap-3">
        <div className="flex items-center justify-center gap-2">
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
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              const today = new Date();
              onWeekChange?.(today);
              setSelectedDate(today);
              onSelectedDateChange?.(today);
            }}
            className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      <div className="p-4">
        {selectedDateSessions.length > 0 ? (
          <div className="relative">
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

                  return (
                    <div
                      key={session.id}
                      className={`rounded-xl p-4 cursor-pointer transition-all group transform hover:-translate-y-0.5 shadow-sm border min-w-[260px] ${
                        isActive
                          ? "border-emerald-200 dark:border-emerald-600/50"
                          : "bg-white border border-zinc-200 dark:bg-zinc-900/30 dark:border-zinc-800/60"
                      } backdrop-blur-sm`}
                      onClick={() => onSessionClick?.(session)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between w-full">
                            <h4 className="flex-1 min-w-0 font-medium text-zinc-900 dark:text-white truncate mb-0">
                              {session.name || session.sessionType.name}
                            </h4>

                            <div className="flex items-center gap-1 ml-2 z-10 flex-shrink-0 relative left-2 group-hover:left-0 transition-all">
                              {session.owner && (
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ${getRandomBg(
                                    session.owner.userid.toString()
                                  )}`}
                                >
                                  <img
                                    src={session.owner.picture}
                                    className="w-7 h-7 rounded-full object-cover border-2 border-white dark:border-zinc-800"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "/default-avatar.jpg";
                                    }}
                                  />
                                </div>
                              )}

                              {coHost && (
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ${getRandomBg(
                                    coHost.user.userid.toString()
                                  )} ${session.owner ? "-ml-2" : ""}`}
                                >
                                  <img
                                    src={coHost.user.picture}
                                    className="w-7 h-7 rounded-full object-cover border-2 border-white dark:border-zinc-800"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "/default-avatar.jpg";
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
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
                          </div>
                        </div>

                        <div className="relative">
                          {canManage && onEditSession && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditSession(session.id);
                              }}
                              className="absolute -top-2 -right-2 p-1.5 bg-zinc-900/60 text-zinc-200 hover:text-white transition-colors opacity-0 group-hover:opacity-100 rounded-full shadow-sm border border-zinc-800 z-20"
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
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent" />
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
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    const monday = getMonday(currentWeek);
    const weekDates = getWeekDates(monday);
    const todayInWeek = weekDates.find(
      (date) => date.toDateString() === today.toDateString()
    );

    return todayInWeek || weekDates[0];
  });
  const [loading, setLoading] = useState(false);
  const text = useMemo(() => randomText(login.displayname), []);
  const [statues, setStatues] = useState(new Map<string, string>());
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const router = useRouter();
  const workspaceIdForColors = Array.isArray(router.query.id)
    ? router.query.id[0]
    : router.query.id;
  const {
    sessionColors,
    isLoading: colorsLoading,
    getSessionTypeColor,
    getTextColorForBackground,
  } = useSessionColors(workspaceIdForColors);
  const { userSessionMetrics } = props;

  const monday = getMonday(currentWeek);
  const weekDates = getWeekDates(monday);
  const dayNamesShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const isTodaySelected =
    selectedDate.toDateString() === new Date().toDateString();

  const selectedDateSessions = allSessions
    .filter(
      (s: any) =>
        new Date(s.date).toDateString() === selectedDate.toDateString()
    )
    .sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

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

        <div className="mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 flex flex-col items-center">
              <div className="flex items-center justify-center gap-3">
                <div className="w-full max-w-4xl mx-auto flex items-center gap-3">
                  <button
                    onClick={() => {
                      const previousWeek = new Date(currentWeek);
                      previousWeek.setDate(currentWeek.getDate() - 7);
                      setCurrentWeek(previousWeek);
                    }}
                    className="p-1.5 sm:p-2 rounded-md bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800/40 text-zinc-700 dark:text-zinc-200 transition-colors"
                    title="Previous week"
                  >
                    <IconChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-center gap-2 py-1 px-2">
                      {weekDates.map((date, index) => {
                        const isToday =
                          date.toDateString() === new Date().toDateString();
                        const isSelected =
                          date.toDateString() === selectedDate.toDateString();

                        return (
                          <button
                            key={date.toDateString()}
                            onClick={() => setSelectedDate(date)}
                            className={`flex flex-col items-center justify-center min-w-[44px] sm:min-w-[56px] py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl transition-all transform hover:scale-105 focus:outline-none border ${
                              isSelected
                                ? "bg-primary text-white border-primary shadow-lg"
                                : isToday
                                ? "bg-zinc-800 text-white border-zinc-700"
                                : "bg-white dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800/40"
                            }`}
                          >
                            <span className="text-[10px] uppercase tracking-wide opacity-80">
                              {dayNamesShort[index]}
                            </span>
                            <span
                              className={`mt-1 text-xs sm:text-sm font-semibold ${
                                isSelected
                                  ? "text-white"
                                  : "text-zinc-900 dark:text-zinc-200"
                              }`}
                            >
                              {date.getDate()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const nextWeek = new Date(currentWeek);
                      nextWeek.setDate(currentWeek.getDate() + 7);
                      setCurrentWeek(nextWeek);
                    }}
                    className="p-1.5 sm:p-2 rounded-md bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800/40 text-zinc-700 dark:text-zinc-200 transition-colors"
                    title="Next week"
                  >
                    <IconChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0" />
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-white text-left">
              {isTodaySelected
                ? "Today"
                : selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
            </div>

            <div>
              {workspace.yourPermission?.includes("manage_sessions") && (
                <button
                  onClick={() =>
                    router.push(`/workspace/${router.query.id}/sessions/new`)
                  }
                  className="inline-flex items-center justify-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  <IconPlus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Session</span>
                  <span className="sm:hidden">New</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap -mx-2 gap-y-4">
            {selectedDateSessions.length > 0 ? (
              selectedDateSessions.map((session: any) => {
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

                return (
                  <div className="px-2" key={session.id}>
                    <div
                      className={`rounded-xl p-4 cursor-pointer transition-all group transform hover:-translate-y-0.5 shadow-sm border min-w-[260px] ${
                        isActive
                          ? "border-emerald-200 dark:border-emerald-600/50"
                          : "bg-white border border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-800/60"
                      } backdrop-blur-sm`}
                      onClick={() => handleSessionClick(session)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between w-full">
                            <h4 className="flex-1 min-w-0 font-medium text-zinc-900 dark:text-white truncate mb-0">
                              {session.name || session.sessionType.name}
                            </h4>

                            <div className="flex items-center gap-1 ml-2 z-10 flex-shrink-0 relative left-2 group-hover:left-0 transition-all">
                              {session.owner && (
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-800 ${getRandomBg(
                                    session.owner.userid.toString()
                                  )}`}
                                >
                                  <img
                                    src={
                                      session.owner.picture ||
                                      "/default-avatar.jpg"
                                    }
                                    className="w-7 h-7 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "/default-avatar.jpg";
                                    }}
                                  />
                                </div>
                              )}

                              {coHost && (
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-800 ${getRandomBg(
                                    coHost.user.userid.toString()
                                  )} ${session.owner ? "-ml-2" : ""}`}
                                >
                                  <img
                                    src={
                                      coHost.user.picture ||
                                      "/default-avatar.jpg"
                                    }
                                    className="w-7 h-7 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "/default-avatar.jpg";
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
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
                          </div>
                        </div>

                        <div className="relative">
                          {workspace.yourPermission &&
                            workspace.yourPermission.includes(
                              "manage_sessions"
                            ) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditSession(session.id);
                                }}
                                className="absolute -top-2 -right-2 p-1.5 bg-zinc-900/60 text-zinc-200 hover:text-white transition-colors opacity-0 group-hover:opacity-100 rounded-full shadow-sm border border-zinc-800 z-20"
                                title="Edit session"
                              >
                                <IconEdit className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-40 flex items-center justify-center">
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
            sessionColors={sessionColors}
            colorsReady={!colorsLoading}
          />
        )}
      </div>
    </div>
  );
};

Home.layout = Workspace;

export default Home;
