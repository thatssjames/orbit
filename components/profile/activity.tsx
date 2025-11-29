import React, { Fragment, useEffect, useState, useMemo } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { workspacestate } from "@/state";
import { themeState } from "@/state/theme";
import { FC } from "@/types/settingsComponent";
import { Chart, ChartData, ScatterDataPoint } from "chart.js";
import { Line } from "react-chartjs-2";
import type { ActivitySession, Quota, inactivityNotice } from "@prisma/client";
import Tooltip from "@/components/tooltip";
import moment from "moment";
import { Dialog, Transition } from "@headlessui/react";
import Button from "../button";
import {
  IconMessages,
  IconMoon,
  IconPlayerPlay,
  IconWalk,
  IconCalendarTime,
  IconChartBar,
  IconUsers,
  IconClipboardList,
  IconAdjustments,
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconClock,
} from "@tabler/icons-react";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import { useRouter } from "next/router";

type Props = {
  timeSpent: number;
  timesPlayed: number;
  data: any;
  quotas: Quota[];
  sessionsHosted: number;
  sessionsAttended: number;
  avatar: string;
  sessions: (ActivitySession & {
    user: {
      picture: string | null;
    };
  })[];
  notices: inactivityNotice[];
  adjustments?: any[];
  isHistorical?: boolean;
  historicalPeriod?: {
    start: string;
    end: string;
  } | null;
  loadingHistory?: boolean;
  messages?: number;
  idleTime?: number;
  selectedWeek?: number;
  availableHistory?: any[];
  getCurrentWeekLabel?: () => string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  goToPreviousWeek?: () => void;
  goToNextWeek?: () => void;
};

type TimelineItem =
  | (ActivitySession & {
      __type: "session";
      user: { picture: string | null };
      active: boolean;
    })
  | (inactivityNotice & { __type: "notice" })
  | {
      __type: "adjustment";
      id: string;
      minutes: number;
      actor?: { username?: string };
      createdAt: string;
      reason?: string;
    };

const Activity: FC<Props> = ({
  timeSpent,
  timesPlayed,
  data,
  quotas,
  sessionsAttended,
  sessionsHosted,
  avatar,
  sessions,
  notices,
  adjustments = [],
  isHistorical = false,
  historicalPeriod = null,
  loadingHistory = false,
  messages: propMessages,
  idleTime: propIdleTime,
  selectedWeek = 0,
  availableHistory = [],
  getCurrentWeekLabel,
  canGoBack = false,
  canGoForward = false,
  goToPreviousWeek,
  goToNextWeek,
}) => {
  const router = useRouter();
  const { id } = router.query;

  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [displayMinutes, setDisplayMinutes] = useState<number>(timeSpent);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<
    ChartData<"line", (number | ScatterDataPoint | null)[], unknown>
  >({
    datasets: [],
  });
  const [chartOptions, setChartOptions] = useState({});
  const [timeline, setTimeline] = useState<TimelineItem[]>(() => {
    const approvedNotices = notices.filter((n) => n.approved === true);
    const adj = adjustments.map((a) => ({ ...a, __type: "adjustment" }));
    return [
      ...sessions.map((s) => ({ ...s, __type: "session" })),
      ...approvedNotices.map((n) => ({ ...n, __type: "notice" })),
      ...adj,
    ];
  });
  const [isOpen, setIsOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>({});
  const [concurrentUsers, setConcurrentUsers] = useState<any[]>([]);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustMinutes, setAdjustMinutes] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"award" | "remove">("award");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);
  const [liveSessionTimer, setLiveSessionTimer] =
    useState<NodeJS.Timeout | null>(null);

  const theme = useRecoilValue(themeState);
  const isDark = theme === "dark";

  // Update displayMinutes when timeSpent prop changes (e.g., when switching between weeks)
  useEffect(() => {
    setDisplayMinutes(timeSpent);
  }, [timeSpent]);

  const sortedTimeline = useMemo(() => {
    return [...timeline].sort((a, b) => {
      const aDate =
        a.__type === "adjustment"
          ? new Date((a as any).createdAt).getTime()
          : new Date((a as any).startTime || (a as any).createdAt).getTime();
      const bDate =
        b.__type === "adjustment"
          ? new Date((b as any).createdAt).getTime()
          : new Date((b as any).startTime || (b as any).createdAt).getTime();
      return bDate - aDate;
    });
  }, [timeline]);

  useEffect(() => {
    setChartData({
      labels: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      datasets: [
        {
          label: "Activity in minutes",
          data,
          borderColor: "rgb(var(--group-theme))",
          backgroundColor: "rgb(var(--group-theme))",
          tension: 0.25,
        },
      ],
    });
    setChartOptions({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { color: isDark ? "#fff" : "#222" },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
          },
          ticks: { color: isDark ? "#fff" : "#222" },
        },
        x: {
          grid: {
            color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
          },
          ticks: { color: isDark ? "#fff" : "#222" },
        },
      },
    });
  }, [data, isDark]);

  useEffect(() => {
    const hasLiveSessions = timeline.some(
      (item) => item.__type === "session" && item.active && !item.endTime
    );

    if (hasLiveSessions) {
      const timer = setInterval(() => {
        setTimeline((prev) => [...prev]);
      }, 60000);

      setLiveSessionTimer(timer);

      return () => {
        clearInterval(timer);
        setLiveSessionTimer(null);
      };
    } else if (liveSessionTimer) {
      clearInterval(liveSessionTimer);
      setLiveSessionTimer(null);
    }
  }, [timeline, liveSessionTimer]);

  useEffect(() => {
    return () => {
      if (liveSessionTimer) {
        clearInterval(liveSessionTimer);
      }
    };
  }, [liveSessionTimer]);

  const getQuotaPercentage = (quota: Quota | any) => {
    if (quota.percentage !== undefined) {
      return quota.percentage;
    }
    switch (quota.type) {
      case "mins": {
        return (displayMinutes / quota.value) * 100;
      }
      case "sessions_hosted": {
        return (sessionsHosted / quota.value) * 100;
      }
      case "sessions_attended": {
        return (sessionsAttended / quota.value) * 100;
      }
    }
  };

  const getQuotaProgress = (quota: Quota | any) => {
    if (quota.currentValue !== undefined) {
      return `${quota.currentValue} / ${quota.value} ${
        quota.type === "mins" ? "minutes" : quota.type.replace("_", " ")
      }`;
    }
    switch (quota.type) {
      case "mins": {
        return `${displayMinutes} / ${quota.value} minutes`;
      }
      case "sessions_hosted": {
        return `${sessionsHosted} / ${quota.value} sessions hosted`;
      }
      case "sessions_attended": {
        return `${sessionsAttended} / ${quota.value} sessions attended`;
      }
    }
  };

  const idleMins =
    propIdleTime !== undefined
      ? propIdleTime
      : sessions.reduce((acc, session) => {
          return acc + Number(session.idleTime);
        }, 0);
  const messages =
    propMessages !== undefined
      ? propMessages
      : sessions.reduce((acc, session) => {
          return acc + Number(session.messages);
        }, 0);

  const fetchSession = async (sessionId: string) => {
    setLoading(true);
    setIsOpen(true);
    setConcurrentUsers([]);

    try {
      const { data, status } = await axios.get(
        `/api/workspace/${id}/activity/${sessionId}`
      );
      if (status !== 200) return toast.error("Could not fetch session.");
      if (!data.universe) {
        setLoading(false);
        return setDialogData({
          type: "session",
          data: data.message,
          universe: null,
        });
      }

      setDialogData({
        type: "session",
        data: data.message,
        universe: data.universe,
      });

      if (data.message?.startTime && data.message?.endTime) {
        try {
          const concurrentResponse = await axios.get(
            `/api/workspace/${id}/activity/concurrent?sessionId=${sessionId}&startTime=${data.message.startTime}&endTime=${data.message.endTime}`
          );

          if (concurrentResponse.status === 200) {
            setConcurrentUsers(concurrentResponse.data.users || []);
          }
        } catch (error) {
          console.error("Failed to fetch concurrent users:", error);
        }
      }

      setLoading(false);
    } catch (error) {
      return toast.error("Could not fetch session.");
    }
  };

  const types: {
    [key: string]: string;
  } = {
    mins: "minutes",
    sessions_hosted: "sessions hosted",
    sessions_attended: "sessions attended",
  };

  const submitAdjustment = async () => {
    const val = Math.min(Math.max(adjustMinutes, 0), 1000);
    if (!val || val <= 0) return toast.error("Enter minutes > 0");
    if (val !== adjustMinutes) setAdjustMinutes(val);
    setSubmittingAdjust(true);
    try {
      const { data } = await axios.post(
        `/api/workspace/${id}/activity/adjustment`,
        {
          userId: router.query.uid,
          minutes: val,
          action: adjustType,
          reason: adjustReason,
        }
      );
      if (!data.success) throw new Error("Failed");
      setTimeline((prev) => [
        { ...data.adjustment, __type: "adjustment" },
        ...prev,
      ]);
      setDisplayMinutes(
        (prev) => prev + (adjustType === "remove" ? -val : val)
      );
      toast.success("Adjustment saved");
      setAdjustModal(false);
      setAdjustMinutes(0);
      setAdjustReason("");
    } catch (e) {
      toast.error("Could not save adjustment");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  return (
    <>
      <Toaster position="bottom-center" />
      {getCurrentWeekLabel && (
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-700 rounded-full px-4 py-3 shadow-sm border border-zinc-200 dark:border-zinc-600">
            <button
              onClick={goToPreviousWeek}
              disabled={!canGoBack || loadingHistory}
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center px-3">
              <p className="text-sm font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                {selectedWeek > 0 && availableHistory[selectedWeek - 1] ? (
                  <>
                    {moment(
                      availableHistory[selectedWeek - 1].period.start
                    ).format("MMM DD")}{" "}
                    -{" "}
                    {moment(
                      availableHistory[selectedWeek - 1].period.end
                    ).format("MMM DD, YYYY")}
                  </>
                ) : (
                  getCurrentWeekLabel()
                )}
              </p>
            </div>
            <button
              onClick={goToNextWeek}
              disabled={!canGoForward || loadingHistory}
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loadingHistory ? (
        <div className="flex items-center justify-center py-12">
          <div className="bg-white dark:bg-zinc-700 rounded-xl p-8 max-w-md mx-auto text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <IconChartBar className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
              Loading Historical Data
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Please wait while we fetch the activity data...
            </p>
          </div>
        </div>
      ) : (
        <div>
          {isHistorical && historicalPeriod && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-lg">
                  <IconCalendarTime className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    Historical Activity Data
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Showing activity from{" "}
                    {moment(historicalPeriod.start).format("MMM DD")} -{" "}
                    {moment(historicalPeriod.end).format("MMM DD, YYYY")}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            className={`grid gap-4 ${
              isHistorical ? "xl:grid-cols-1" : "xl:grid-cols-2"
            }`}
          >
            {!isHistorical &&
              workspace.yourPermission?.includes("manage_activity") && (
                <div className="flex justify-end xl:col-span-2">
                  <button
                    onClick={() => setAdjustModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                  >
                    <IconAdjustments className="w-4 h-4" />
                    Manual Adjustment
                  </button>
                </div>
              )}
            {!isHistorical && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-zinc-700 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4 border-b">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <IconChartBar className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                      Activity Chart
                    </h2>
                  </div>
                  <div className="p-4 h-[300px]">
                    <Line options={chartOptions} data={chartData} />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-700 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4 border-b">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <IconCalendarTime className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                      Timeline
                    </h2>
                  </div>
                  <div className="p-4">
                    {sortedTimeline.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="bg-white dark:bg-zinc-700 rounded-xl p-8 max-w-md mx-auto">
                          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <IconClipboardList className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-lg font-medium  text-zinc-900 dark:text-white mb-1">
                            No Activity
                          </h3>
                          <p className="text-sm  text-zinc-900 dark:text-white mb-4">
                            No activity has been recorded yet
                          </p>
                        </div>
                      </div>
                    ) : (
                      <ol className="relative border-l border-gray-200 ml-3 mt-3">
                        {sortedTimeline.map((item: TimelineItem) => {
                          if (item.__type === "notice") {
                            return (
                              <div key={`notice-${item.id}`}>
                                <li className="mb-6 ml-6">
                                  <span className="flex absolute -left-3 justify-center items-center w-6 h-6 bg-primary rounded-full ring-4 ring-white">
                                    <img
                                      className="rounded-full"
                                      src={avatar}
                                      alt="timeline avatar"
                                    />
                                  </span>
                                  <div className="p-4 bg-zinc-50 dark:bg-zinc-700 rounded-lg border border-zinc-100 dark:border-zinc-600">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className="text-sm font-medium text-zinc-900">
                                        Inactivity Notice
                                      </p>
                                      <time className="text-xs text-zinc-500">
                                        {moment(item.startTime).format(
                                          "DD MMM"
                                        )}{" "}
                                        -{" "}
                                        {moment(item.endTime).format(
                                          "DD MMM YYYY"
                                        )}
                                      </time>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                      {item.reason}
                                    </p>
                                  </div>
                                </li>
                              </div>
                            );
                          }
                          if (item.__type === "adjustment") {
                            const positive = item.minutes > 0;
                            return (
                              <div key={`adjust-${item.id}`}>
                                <li className="mb-6 ml-6">
                                  <span
                                    className={`flex absolute -left-3 justify-center items-center w-6 h-6 ${
                                      positive ? "bg-green-500" : "bg-red-500"
                                    } rounded-full ring-4 ring-white text-white text-xs font-bold`}
                                  >
                                    {positive ? "+" : "-"}
                                  </span>
                                  <div className="p-4 bg-zinc-50 dark:bg-zinc-600 rounded-lg border border-zinc-100 dark:border-zinc-600">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                        Manual Adjustment
                                      </p>
                                      <time className="text-xs text-zinc-500 dark:text-zinc-300">
                                        {moment(item.createdAt).format(
                                          "DD MMM YYYY, HH:mm"
                                        )}
                                      </time>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-200">
                                      {positive ? "Awarded" : "Removed"}{" "}
                                      {Math.abs(item.minutes)} minutes by{" "}
                                      {item.actor?.username || "Unknown"}
                                    </p>
                                    {item.reason && (
                                      <p className="text-xs italic text-zinc-500 dark:text-zinc-400 mt-1">
                                        Reason: {item.reason}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              </div>
                            );
                          }
                          const isLive = item.active && !item.endTime;
                          const sessionDuration = isLive
                            ? Math.floor(
                                (new Date().getTime() -
                                  new Date(item.startTime).getTime()) /
                                  (1000 * 60)
                              )
                            : Math.floor(
                                (new Date(
                                  item.endTime || new Date()
                                ).getTime() -
                                  new Date(item.startTime).getTime()) /
                                  (1000 * 60)
                              );

                          return (
                            <div key={`session-${item.id}`}>
                              <li className="mb-6 ml-6">
                                <span
                                  className={`flex absolute -left-3 justify-center items-center w-6 h-6 ${
                                    isLive
                                      ? "bg-green-500 animate-pulse"
                                      : "bg-primary"
                                  } rounded-full ring-4 ring-white`}
                                >
                                  {isLive ? (
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                  ) : (
                                    <img
                                      className="rounded-full"
                                      src={
                                        item.user.picture
                                          ? item.user.picture
                                          : avatar
                                      }
                                      alt="timeline avatar"
                                    />
                                  )}
                                </span>
                                <div
                                  onClick={() =>
                                    !isLive && fetchSession(item.id)
                                  }
                                  className={`p-4 ${
                                    isLive
                                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                                      : "bg-zinc-50 dark:bg-zinc-500 border-zinc-100"
                                  } rounded-lg border ${
                                    !isLive
                                      ? "cursor-pointer hover:bg-zinc-100 transition-colors"
                                      : ""
                                  }`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                        Activity Session
                                      </p>
                                      {isLive && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                          LIVE
                                        </span>
                                      )}
                                    </div>
                                    <time className="text-xs text-zinc-500 dark:text-white">
                                      {isLive ? (
                                        <>
                                          Started at{" "}
                                          {moment(item.startTime).format(
                                            "HH:mm"
                                          )}{" "}
                                          • {sessionDuration}m
                                        </>
                                      ) : (
                                        <>
                                          {moment(item.startTime).format(
                                            "HH:mm"
                                          )}{" "}
                                          -{" "}
                                          {moment(item.endTime).format("HH:mm")}{" "}
                                          on{" "}
                                          {moment(item.startTime).format(
                                            "DD MMM YYYY"
                                          )}{" "}
                                          • {sessionDuration}m
                                        </>
                                      )}
                                    </time>
                                  </div>
                                  {isLive && (
                                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                                      Currently active in game
                                    </p>
                                  )}
                                </div>
                              </li>
                            </div>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-white dark:bg-zinc-700 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <IconPlayerPlay className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                    Activity Metrics
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-600 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                        {displayMinutes}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Time Active
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-600 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                        {messages}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Messages
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-600 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                        {idleMins}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Idle Time
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-700 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <IconUsers className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                    Sessions
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-600 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                        {sessionsHosted}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Sessions Hosted
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-600 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                        {sessionsAttended}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Sessions Attended
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {quotas.length > 0 && (
                <div className="bg-white dark:bg-zinc-700 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4 border-b">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <IconChartBar className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-medium dark:text-white text-zinc-900">
                      Activity Quotas
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="grid gap-4">
                      {quotas.map((quota: any) => (
                        <div
                          key={quota.id}
                          className="bg-zinc-50 dark:bg-zinc-500 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-medium dark:text-white text-zinc-900">
                              {quota.name}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-white">
                              {getQuotaProgress(quota)}
                            </p>
                          </div>
                          <Tooltip
                            orientation="top"
                            tooltipText={getQuotaProgress(quota)}
                          >
                            <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{
                                  width: `${Math.min(
                                    getQuotaPercentage(quota) || 0,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setIsOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white dark:bg-zinc-800 text-left align-middle shadow-xl transition-all">
                  {dialogData?.universe?.thumbnail && (
                    <div className="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600">
                      <img
                        src={dialogData.universe.thumbnail}
                        alt="Game thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                    </div>
                  )}

                  <div className="p-6 border-b border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <IconClock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <Dialog.Title
                          as="h3"
                          className="text-xl font-semibold text-zinc-900 dark:text-white"
                        >
                          {dialogData?.data?.sessionMessage ||
                            dialogData?.universe?.name ||
                            "Unknown Game"}
                        </Dialog.Title>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Activity Session Details
                        </p>
                      </div>
                    </div>
                    {concurrentUsers.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Played with:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {concurrentUsers.map((user: any) => (
                            <div
                              key={user.sessionId}
                              className={`w-8 h-8 rounded-full overflow-hidden ring-2 ring-white dark:ring-zinc-800 ${getRandomBg(
                                user.userId
                              )}`}
                              title={user.username}
                            >
                              <img
                                src={user.picture || "/default-avatar.jpg"}
                                alt={user.username}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    {loading ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                            {(() => {
                              const duration = moment.duration(
                                moment(dialogData.data?.endTime).diff(
                                  moment(dialogData.data?.startTime)
                                )
                              );
                              const minutes = Math.floor(duration.asMinutes());
                              return `${minutes} ${
                                minutes === 1 ? "minute" : "minutes"
                              }`;
                            })()}
                          </div>
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            Duration
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 text-center">
                            <div className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                              {dialogData.data?.idleTime || 0}
                            </div>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                              Idle{" "}
                              {(dialogData.data?.idleTime || 0) === 1
                                ? "minute"
                                : "minutes"}
                            </div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 text-center">
                            <div className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                              {dialogData.data?.messages || 0}
                            </div>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                              {(dialogData.data?.messages || 0) === 1
                                ? "Message"
                                : "Messages"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-6">
                      <button
                        type="button"
                        className="w-full justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={adjustModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setAdjustModal(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium text-zinc-900 dark:text-white mb-4"
                  >
                    Manual Adjustment
                  </Dialog.Title>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAdjustType("award")}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                          adjustType === "award"
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-transparent"
                        }`}
                      >
                        Award
                      </button>
                      <button
                        onClick={() => setAdjustType("remove")}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                          adjustType === "remove"
                            ? "bg-red-500 text-white border-red-500"
                            : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-transparent"
                        }`}
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-300">
                        Minutes
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={adjustMinutes}
                        onChange={(e) =>
                          setAdjustMinutes(
                            Math.min(
                              1000,
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          )
                        }
                        className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-white text-sm outline-none"
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-300">
                        Reason (optional)
                      </label>
                      <textarea
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-white text-sm outline-none resize-none"
                        placeholder="Recognition for outstanding support"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button
                      onClick={() => setAdjustModal(false)}
                      className="flex-1 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={submittingAdjust}
                      onClick={submitAdjustment}
                      className="flex-1 px-4 py-2 rounded-lg bg-primary text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary/90 transition"
                    >
                      {submittingAdjust
                        ? "Saving..."
                        : adjustType === "award"
                        ? "Award Minutes"
                        : "Remove Minutes"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

const BG_COLORS = [
  "bg-red-200",
  "bg-green-200",
  "bg-emerald-200",
  "bg-red-300",
  "bg-green-300",
  "bg-emerald-300",
  "bg-amber-200",
  "bg-yellow-200",
  "bg-red-100",
  "bg-green-100",
  "bg-lime-200",
  "bg-rose-200",
  "bg-amber-300",
  "bg-teal-200",
  "bg-lime-300",
  "bg-rose-300",
];

function getRandomBg(userid: string, username?: string) {
  const key = `${userid ?? ""}:${username ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) ^ key.charCodeAt(i);
  }
  const index = (hash >>> 0) % BG_COLORS.length;
  return BG_COLORS[index];
}

export default Activity;
