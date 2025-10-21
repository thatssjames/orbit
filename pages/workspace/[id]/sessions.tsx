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

export const getServerSideProps = withPermissionCheckSsr(async ({ query }) => {
  const activeSessions = await prisma.session.findMany({
    where: {
      startedAt: {
        lte: new Date(),
      },
      ended: null,
      sessionType: {
        workspaceGroupId: parseInt(query.id as string),
      },
    },
    include: {
      owner: true,
      sessionType: true,
    },
  });

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
      date: {
        gte: monday,
        lte: sunday,
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

  return {
    props: {
      sessions: JSON.parse(
        JSON.stringify(activeSessions, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ) as typeof activeSessions,
      allSessions: JSON.parse(
        JSON.stringify(allSessions, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ) as typeof allSessions,
    },
  };
});

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
}> = ({
  currentWeek,
  sessions,
  canManage,
  onEditSession,
  onSessionClick,
  workspaceId,
}) => {
  const { getSessionTypeColor, getRecurringColor, getTextColorForBackground } =
    useSessionColors(workspaceId);
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

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto md:overflow-x-visible">
        <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-zinc-700 min-w-[700px] md:min-w-0">
          {weekDates.map((date, index) => {
            const localDateKey = date.toLocaleDateString();
            const daySessions = sessionsByDate[localDateKey] || [];
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div
                key={date.toDateString()}
                className={`min-h-[200px] md:min-h-[250px] p-3 ${
                  isToday ? "bg-primary/5 dark:bg-primary/10" : ""
                }`}
              >
                <div
                  className={`text-sm font-medium mb-2 ${
                    isToday ? "text-primary" : "text-zinc-900 dark:text-white"
                  }`}
                >
                  {dayNames[index]}
                </div>
                <div
                  className={`text-lg font-bold mb-3 ${
                    isToday
                      ? "text-primary"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="space-y-2">
                  {daySessions.map((session: any) => {
                    const isRecurring = session.scheduleId !== null;
                    return (
                      <div
                        key={session.id}
                        className="bg-primary/10 dark:bg-primary/20 rounded-lg p-2 text-xs relative group cursor-pointer hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
                        onClick={() => onSessionClick?.(session)}
                      >
                        <div className="font-medium text-primary mb-1 truncate">
                          {session.name || session.sessionType.name}
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          {session.type && (
                            <span
                              className={`${getSessionTypeColor(
                                session.type
                              )} ${getTextColorForBackground(
                                getSessionTypeColor(session.type)
                              )} px-1.5 py-0.5 rounded text-xs font-medium`}
                            >
                              {session.type.charAt(0).toUpperCase() +
                                session.type.slice(1)}
                            </span>
                          )}
                          {isRecurring && (
                            <span
                              className={`${getRecurringColor()} ${getTextColorForBackground(
                                getRecurringColor()
                              )} px-1.5 py-0.5 rounded text-xs font-medium`}
                            >
                              Recurring
                            </span>
                          )}
                        </div>
                        <div className="text-zinc-600 dark:text-zinc-400 truncate">
                          {new Date(session.date).toLocaleTimeString(
                            undefined,
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            }
                          )}
                        </div>
                        <div className="text-zinc-500 dark:text-zinc-500 truncate">
                          {session.owner?.username || "Unclaimed"}
                        </div>
                        {canManage && onEditSession && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSession(session.id);
                            }}
                            className="absolute top-1 right-1 p-1 text-zinc-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit session"
                          >
                            <IconEdit className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

type pageProps = {
  sessions: (Session & {
    owner: user;
    sessionType: SessionType;
  })[];
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
};

const Home: pageWithLayout<pageProps> = (props) => {
  const [login, setLogin] = useRecoilState(loginState);
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [sessions, setSessions] = useState<any[]>(props.sessions);
  const [allSessions, setAllSessions] = useState<any[]>(props.allSessions);
  const [loading, setLoading] = useState(false);
  const text = useMemo(() => randomText(login.displayname), []);
  const [statues, setStatues] = useState(new Map<string, string>());
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const router = useRouter();

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
          setSessions(
            sessions.filter((s) => s.scheduleId !== session.scheduleId)
          );
          setAllSessions(
            allSessions.filter((s) => s.scheduleId !== session.scheduleId)
          );
        }
      } else {
        toast.success("Session deleted successfully");
        setSessions(sessions.filter((s) => s.id !== sessionId));
        setAllSessions(allSessions.filter((s) => s.id !== sessionId));
      }
      loadWeekSessions(currentWeek);
    } catch (error: any) {
      console.error("Delete session error:", error);
      toast.error(error?.response?.data?.error || "Failed to delete session");
    }
  };

  const loadWeekSessions = async (weekDate: Date) => {
    setLoading(true);
    try {
      const monday = getMonday(weekDate);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setUTCHours(23, 59, 59, 999);

      const response = await axios.get(
        `/api/workspace/${router.query.id}/sessions/week`,
        {
          params: {
            startDate: monday.toISOString(),
            endDate: sunday.toISOString(),
          },
        }
      );
      setAllSessions(response.data);
    } catch (error) {
      console.error("Failed to load week sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeekSessions(currentWeek);
  }, [currentWeek, router.query.id]);

  // Handle refresh parameter from session creation
  useEffect(() => {
    if (router.query.refresh === "true") {
      loadWeekSessions(currentWeek);
      // Remove refresh parameter from URL without reload
      router.replace(`/workspace/${router.query.id}/sessions`, undefined, {
        shallow: true,
      });
    }
  }, [router.query.refresh]);

  const refreshCurrentWeek = () => {
    loadWeekSessions(currentWeek);
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
        setSessions(sessions.filter((session) => session.id !== id));
        return "Session ended successfully";
      },
      error: "Failed to end session",
    });
  };

  useEffect(() => {
    const getAllStatues = async () => {
      const newStatues = new Map<string, string>();
      for (const session of sessions) {
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
  }, [sessions]);

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
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <IconCalendarEvent className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                Ongoing Sessions
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                View and manage currently active sessions
              </p>
            </div>
          </div>

          {sessions.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                          {session.sessionType.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <img
                            src={
                              (session.owner.picture ||
                                "/default-avatar.png") as string
                            }
                            className="w-8 h-8 rounded-full bg-primary border-2 border-white dark:border-zinc-700"
                            alt={session.owner.username || "User"}
                          />
                          <div>
                            <p className="text-sm text-zinc-900 dark:text-white">
                              {session.owner.username}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {statues.get(session.id)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => endSession(session.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <IconTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-8 text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <IconCalendarEvent className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  No Active Sessions
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  There are no sessions currently in progress
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
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

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const previousWeek = new Date(currentWeek);
                  previousWeek.setDate(currentWeek.getDate() - 7);
                  setCurrentWeek(previousWeek);
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
                    month: "short",
                    day: "numeric",
                  })} - ${sunday.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}`;
                })()}
              </span>
              <button
                onClick={() => {
                  const nextWeek = new Date(currentWeek);
                  nextWeek.setDate(currentWeek.getDate() + 7);
                  setCurrentWeek(nextWeek);
                }}
                className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
              >
                <IconChevronRight className="w-4 h-4" />
              </button>
            </div>
            {workspace.yourPermission?.includes("manage_sessions") && (
              <button
                onClick={() =>
                  router.push(`/workspace/${router.query.id}/sessions/new`)
                }
                className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                <IconPlus className="w-4 h-4 mr-2" />
                New Session
              </button>
            )}
          </div>

          <WeeklyCalendar
            currentWeek={currentWeek}
            sessions={allSessions}
            canManage={workspace.yourPermission?.includes("manage_sessions")}
            onEditSession={handleEditSession}
            onSessionClick={handleSessionClick}
            workspaceId={
              Array.isArray(router.query.id)
                ? router.query.id[0]
                : router.query.id
            }
          />
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
            onUpdate={() => {
              loadWeekSessions(currentWeek);
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
