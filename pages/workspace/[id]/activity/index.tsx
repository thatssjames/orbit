import workspace from "@/layouts/workspace";
import { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo, Fragment } from "react";
import { useRecoilState } from "recoil";
import moment from "moment";
import {
  IconChevronRight,
  IconUsers,
  IconClock,
  IconUserCircle,
  IconMessageCircle2,
  IconArrowLeft,
  IconCalendarTime,
  IconTarget,
  IconClipboardList,
  IconChartBar,
} from "@tabler/icons-react";
import Tooltip from "@/components/tooltip";
import randomText from "@/utils/randomText";
import toast, { Toaster } from "react-hot-toast";
import { Dialog, Transition } from "@headlessui/react";

const Activity: pageWithLayout = () => {
  const router = useRouter();
  const { id } = router.query;
  const [login] = useRecoilState(loginState);
  const [workspace] = useRecoilState(workspacestate);
  const text = useMemo(() => randomText(login.displayname), []);
  const [myData, setMyData] = useState<any>(null);
  const [myQuotas, setMyQuotas] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<any>({});
  const [concurrentUsers, setConcurrentUsers] = useState<any[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const profileRes = await axios.get(
          `/api/workspace/${id}/profile/${login.userId}`
        );
        const profileData = profileRes.data.data;
        let totalMinutes = 0;
        let totalMessages = 0;
        let totalIdleTime = 0;
        let sessionsHosted = 0;
        let sessionsAttended = 0;

        if (profileData.sessions) {
          profileData.sessions.forEach((session: any) => {
            if (session.endTime) {
              const duration = Math.round(
                (new Date(session.endTime).getTime() -
                  new Date(session.startTime).getTime()) /
                  60000
              );
              totalMinutes += duration;
            }
            totalMessages += session.messages || 0;
            totalIdleTime += Number(session.idleTime) || 0;
          });
        }
        if (profileData.adjustments) {
          totalMinutes += profileData.adjustments.reduce(
            (sum: number, adj: any) => sum + adj.minutes,
            0
          );
        }
        sessionsHosted = profileData.roleBasedSessionsHosted || 0;
        sessionsAttended = profileData.roleBasedSessionsAttended || 0;
        setMyData({
          minutes: totalMinutes,
          messages: totalMessages,
          idleTime: Math.round(totalIdleTime / 60),
          sessionsHosted,
          sessionsAttended,
          picture: profileData.avatar,
          username: login.displayname,
        });

        if (profileData.quotas) {
          const quotasWithProgress = profileData.quotas.map((quota: any) => {
            let currentValue = 0;
            let percentage = 0;

            switch (quota.type) {
              case "mins":
                currentValue = totalMinutes;
                percentage = (totalMinutes / quota.value) * 100;
                break;
              case "sessions_hosted":
                currentValue = sessionsHosted;
                percentage = (sessionsHosted / quota.value) * 100;
                break;
              case "sessions_attended":
                currentValue = sessionsAttended;
                percentage = (sessionsAttended / quota.value) * 100;
                break;
            }
            return {
              ...quota,
              currentValue,
              percentage: Math.min(percentage, 100),
            };
          });
          setMyQuotas(quotasWithProgress);
        }

        if (profileData.assignments) {
          setMyAssignments(profileData.assignments);
        }
        const timelineData = [];
        if (profileData.sessions) {
          timelineData.push(
            ...profileData.sessions.map((s: any) => ({
              ...s,
              __type: "session",
            }))
          );
        }
        if (profileData.adjustments) {
          timelineData.push(
            ...profileData.adjustments.map((a: any) => ({
              ...a,
              __type: "adjustment",
            }))
          );
        }
        if (profileData.notices) {
          const approvedNotices = profileData.notices.filter(
            (n: any) => n.approved === true
          );
          timelineData.push(
            ...approvedNotices.map((n: any) => ({ ...n, __type: "notice" }))
          );
        }
        timelineData.sort((a, b) => {
          const aDate =
            a.__type === "adjustment"
              ? new Date(a.createdAt).getTime()
              : new Date(a.startTime || a.createdAt).getTime();
          const bDate =
            b.__type === "adjustment"
              ? new Date(b.createdAt).getTime()
              : new Date(b.startTime || b.createdAt).getTime();
          return bDate - aDate;
        });

        setTimeline(timelineData);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    }

    if (id && login.userId) {
      fetchUserData();
      const interval = setInterval(() => {
        fetchUserData();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [id, login.userId]);

  const getQuotaTypeLabel = (type: string) => {
    switch (type) {
      case "mins":
        return "minutes";
      case "sessions_hosted":
        return "sessions hosted";
      case "sessions_attended":
        return "sessions attended";
      default:
        return type;
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    setLoadingSession(true);
    setIsSessionModalOpen(true);
    setConcurrentUsers([]);
    
    try {
      const sessionResponse = await axios.get(`/api/workspace/${id}/activity/${sessionId}`);
      if (sessionResponse.status !== 200) {
        toast.error("Could not fetch session details.");
        setIsSessionModalOpen(false);
        return;
      }
      const sessionData = sessionResponse.data;
      setSessionDetails(sessionData);

      if (sessionData.message?.startTime && sessionData.message?.endTime) {
        try {
          const concurrentResponse = await axios.get(
            `/api/workspace/${id}/activity/concurrent?sessionId=${sessionId}&startTime=${sessionData.message.startTime}&endTime=${sessionData.message.endTime}`
          );
          
          if (concurrentResponse.status === 200) {
            setConcurrentUsers(concurrentResponse.data.users || []);
          }
        } catch (error) {
          console.error("Failed to fetch concurrent users:", error);
        }
      }
    } catch (error) {
      toast.error("Could not fetch session details.");
      setIsSessionModalOpen(false);
    } finally {
      setLoadingSession(false);
    }
  };

  return (
    <div className="pagePadding">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-medium text-zinc-900 dark:text-white">
              My Activity
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Your activity metrics and overview
            </p>
          </div>
        </div>
        <div className="mb-8">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b dark:border-zinc-700">
              <div className="bg-primary/10 p-2 rounded-lg">
                <IconUserCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                  Your Activity
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Activity overview this period
                </p>
              </div>
            </div>
            <div className="p-4">
              {myData ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-zinc-50 dark:bg-zinc-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                        {myData.minutes}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Minutes
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                        {myData.messages}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Messages
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Loading your activity data...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {myData && (
          <div className="mb-8">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b dark:border-zinc-700">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <IconUsers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                    Your Sessions
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Session participation this period
                  </p>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 dark:bg-zinc-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                      {myData.sessionsHosted}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Sessions Hosted
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                      {myData.sessionsAttended}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Sessions Attended
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {myQuotas.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 p-2 rounded-lg">
                <IconTarget className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-medium text-zinc-900 dark:text-white">
                Your Quotas
              </h3>
            </div>
            <div className="grid gap-4">
              {myQuotas.map((quota: any) => (
                <div
                  key={quota.id}
                  className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-700 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      {quota.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {quota.currentValue} / {quota.value}{" "}
                      {getQuotaTypeLabel(quota.type)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          quota.percentage >= 100
                            ? "bg-green-500"
                            : quota.percentage >= 70
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min(quota.percentage, 100)}%`,
                        }}
                      ></div>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        quota.percentage >= 100
                          ? "text-green-600 dark:text-green-400"
                          : quota.percentage >= 70
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {Math.round(quota.percentage)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {myAssignments.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="flex items-center gap-3 p-4 border-b dark:border-zinc-600">
              <div className="bg-primary/10 p-2 rounded-lg">
                <IconTarget className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                Assignments
              </h2>
            </div>
            <div className="p-4">
              <div className="grid gap-4">
                {myAssignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    className="bg-zinc-50 dark:bg-zinc-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-zinc-900 dark:text-white">
                        {assignment.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Assigned to your role
                      </p>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">
                      {assignment.description ||
                        `${assignment.value} ${getQuotaTypeLabel(
                          assignment.type
                        )} required`}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{
                            width: `${Math.min(
                              assignment.progress || 0,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white min-w-[3rem] text-right">
                        {Math.round(assignment.progress || 0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="flex items-center gap-3 p-4 border-b dark:border-zinc-600">
            <div className="bg-primary/10 p-2 rounded-lg">
              <IconCalendarTime className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
              Activity Timeline
            </h2>
          </div>
          <div className="p-4">
            {timeline.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <IconClipboardList className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
                  No Activity
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  No activity has been recorded yet
                </p>
              </div>
            ) : (
              <ol className="relative border-l border-gray-200 dark:border-zinc-600 ml-3 mt-3">
                {timeline.slice(0, 10).map((item: any) => {
                  if (item.__type === "session") {
                    const isLive = item.active && !item.endTime;
                    const sessionDuration = isLive
                      ? Math.floor(
                          (new Date().getTime() -
                            new Date(item.startTime).getTime()) /
                            (1000 * 60)
                        )
                      : Math.floor(
                          (new Date(item.endTime || new Date()).getTime() -
                            new Date(item.startTime).getTime()) /
                            (1000 * 60)
                        );

                    return (
                      <li key={`session-${item.id}`} className="mb-6 ml-6">
                        <span
                          className={`flex absolute -left-3 justify-center items-center w-6 h-6 ${
                            isLive ? "bg-green-500 animate-pulse" : "bg-primary"
                          } rounded-full ring-4 ring-white dark:ring-zinc-800`}
                        >
                          {isLive ? (
                            <div className="w-3 h-3 bg-white rounded-full"></div>
                          ) : (
                            <img
                              className="rounded-full w-4 h-4"
                              src={myData?.picture || "/default-avatar.png"}
                              alt="avatar"
                            />
                          )}
                        </span>
                        <div
                          className={`p-4 ${
                            isLive
                              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                              : "bg-zinc-50 dark:bg-zinc-700 border-zinc-100 dark:border-zinc-600 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-600"
                          } rounded-lg border transition-colors`}
                          onClick={() => !isLive && fetchSessionDetails(item.id)}
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
                            <time className="text-xs text-zinc-500 dark:text-zinc-400">
                              {isLive ? (
                                <>
                                  Started at{" "}
                                  {moment(item.startTime).format("HH:mm")} •{" "}
                                  {sessionDuration}m
                                </>
                              ) : (
                                <>
                                  {moment(item.startTime).format("HH:mm")} -{" "}
                                  {moment(item.endTime).format("HH:mm")} on{" "}
                                  {moment(item.startTime).format("DD MMM YYYY")}{" "}
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
                    );
                  }

                  if (item.__type === "adjustment") {
                    const positive = item.minutes > 0;
                    return (
                      <li key={`adjustment-${item.id}`} className="mb-6 ml-6">
                        <span
                          className={`flex absolute -left-3 justify-center items-center w-6 h-6 ${
                            positive ? "bg-green-500" : "bg-red-500"
                          } rounded-full ring-4 ring-white dark:ring-zinc-800 text-white text-xs font-bold`}
                        >
                          {positive ? "+" : "-"}
                        </span>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-700 rounded-lg border border-zinc-100 dark:border-zinc-600">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              Manual Adjustment
                            </p>
                            <time className="text-xs text-zinc-500 dark:text-zinc-400">
                              {moment(item.createdAt).format(
                                "DD MMM YYYY HH:mm"
                              )}
                            </time>
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {positive ? "Added" : "Removed"}{" "}
                            {Math.abs(item.minutes)} minutes
                          </p>
                          {item.reason && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                              {item.reason}
                            </p>
                          )}
                          {item.actor?.username && (
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                              by {item.actor.username}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  }

                  if (item.__type === "notice") {
                    return (
                      <li key={`notice-${item.id}`} className="mb-6 ml-6">
                        <span className="flex absolute -left-3 justify-center items-center w-6 h-6 bg-primary rounded-full ring-4 ring-white dark:ring-zinc-800">
                          <img
                            className="rounded-full w-4 h-4"
                            src={myData?.picture || "/default-avatar.png"}
                            alt="avatar"
                          />
                        </span>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-700 rounded-lg border border-zinc-100 dark:border-zinc-600">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              Inactivity Notice
                            </p>
                            <time className="text-xs text-zinc-500 dark:text-zinc-400">
                              {moment(item.from).format("DD MMM")} -{" "}
                              {moment(item.to).format("DD MMM YYYY")}
                            </time>
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {item.reason}
                          </p>
                        </div>
                      </li>
                    );
                  }

                  return null;
                })}
              </ol>
            )}
          </div>
        </div>
        <h2 className="text-base font-medium text-zinc-900 dark:text-white mb-2">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {workspace.yourPermission.includes("admin") && (
            <ActionButton
              icon={IconTarget}
              title="Manage Quotas"
              desc="Configure quotas"
              onClick={() => router.push(`/workspace/${id}/activity/quotas`)}
            />
          )}
        </div>
      </div>

      <Transition appear show={isSessionModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsSessionModalOpen(false)}>
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
                leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white dark:bg-zinc-800 text-left align-middle shadow-xl transition-all">
                  {sessionDetails?.universe?.thumbnail && (
                    <div className="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600">
                      <img
                        src={sessionDetails.universe.thumbnail}
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
                        <Dialog.Title as="h3" className="text-xl font-semibold text-zinc-900 dark:text-white">
                          {sessionDetails?.message?.sessionMessage || sessionDetails?.universe?.name || 'Unknown Game'}
                        </Dialog.Title>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Activity Session Details
                        </p>
                      </div>
                    </div>
                    {concurrentUsers.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Played with:</span>
                        <div className="flex flex-wrap gap-2">
                          {concurrentUsers.map((user: any) => (
                            <div
                              key={user.sessionId}
                              className={`w-8 h-8 rounded-full overflow-hidden ring-2 ring-white dark:ring-zinc-800 ${getRandomBg(user.userId)}`}
                              title={user.username}
                            >
                              <img
                                src={user.picture || "/default-avatar.png"}
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
                    {loadingSession ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                            {(() => {
                              if (!sessionDetails.message?.endTime || !sessionDetails.message?.startTime) {
                                return "Ended";
                              }
                              const duration = moment.duration(
                                moment(sessionDetails.message.endTime).diff(moment(sessionDetails.message.startTime))
                              );
                              const minutes = Math.floor(duration.asMinutes());
                              return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
                            })()}
                          </div>
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">Duration</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 text-center">
                            <div className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                              {sessionDetails.message?.idleTime || 0}
                            </div>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                              Idle {(sessionDetails.message?.idleTime || 0) === 1 ? 'minute' : 'minutes'}
                            </div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 text-center">
                            <div className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                              {sessionDetails.message?.messages || 0}
                            </div>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                              {(sessionDetails.message?.messages || 0) === 1 ? 'Message' : 'Messages'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-6">
                      <button
                        type="button"
                        className="w-full justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                        onClick={() => setIsSessionModalOpen(false)}>
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

      <Toaster position="bottom-center" />
    </div>
  );
};

const ActionButton = ({ icon: Icon, title, desc, onClick }: any) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-all text-left"
  >
    <div className="bg-primary/10 p-2 rounded-lg">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <p className="text-sm font-medium text-zinc-900 dark:text-white">
        {title}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
    </div>
  </button>
);

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

Activity.layout = workspace;

export default Activity;
