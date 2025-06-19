import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Button from "@/components/button";
import Workspace from "@/layouts/workspace";
import toast, { Toaster } from 'react-hot-toast'
import { useRecoilState } from "recoil";
import { useEffect, useState, useMemo } from "react";
import randomText from "@/utils/randomText";
import Tooltip from "@/components/tooltip";
import axios from "axios";
import { useRouter } from "next/router";
import prisma, { schedule, SessionType, Session, user, role } from "@/utils/database";
import { GetServerSideProps } from "next";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import moment from "moment";
import { IconArrowLeft, IconCalendarEvent, IconPlus, IconEdit, IconTrash, IconFilter } from "@tabler/icons-react";

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(async ({ query }) => {
	const sessions = await prisma.schedule.findMany({
		where: {
			sessionType: {
				workspaceGroupId: parseInt(query.id as string)
			}
		},
		include: {
			sessionType: {
				include: {
					hostingRoles: true
				}
			},
			sessions: {
				include: {
					owner: true
				}
			}
		}
	});

	//find sessions that are already claimed by a user
	//get date 3 days from now
	const threeDaysFromNow = new Date();
	threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
	const threeDaysBeforeNow = new Date();
	threeDaysBeforeNow.setDate(threeDaysBeforeNow.getDate() - 3);



	return {
		props: {
			sessions: JSON.parse(JSON.stringify(sessions, (key, value) => (typeof value === 'bigint' ? value.toString() : value))) as typeof sessions,
		}
	}
});
type esession = (schedule & {
	sessionType: (SessionType & {
		hostingRoles: role[]
	});
	sessions: (Session & {
		owner: user
	})[];
})

const Home: pageWithLayout<{
	sessions: esession[]
}> = ({ sessions }) => {
	const [login, setLogin] = useRecoilState(loginState);
	const [workspace, setWorkspace] = useRecoilState(workspacestate);
	const router = useRouter();
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [activeSessions, setActiveSessions] = useState<esession[]>([]);
	const [sessionsData, setSessionsData] = useState(sessions);
	const [isLoading, setIsLoading] = useState(false);
	const [sortBy, setSortBy] = useState<'time' | 'name'>('time');
	const text = useMemo(() => randomText(login.displayname), []);

	const gradients = [
		`to-[#8f75e5] from-[#5c3e8d]`,
		`to-orange-500 from-orange-700`,
		`to-[#f7b733] from-[#de751f]`,
		`to-blue-500 from-blue-700`,
		`to-red-500 from-red-700`,
		`to-green-500 from-green-700`,
		`to-purple-500 from-purple-700`,
		`to-yellow-500 from-yellow-700`,
		`to-pink-500 from-pink-700`,
	]

	function getLastThreeDays() {
		const today = new Date();
		const lastThreeDays = [];
		const nextThreeDays = [];
		for (let i = 0; i < 4; i++) {
			const day = new Date(today);
			day.setDate(day.getDate() - i);
			lastThreeDays.push(day);
		}
		for (let i = 0; i < 3; i++) {
			const day = new Date(today);
			day.setDate(day.getDate() + i + 1);
			nextThreeDays.push(day);
		}
		return [...lastThreeDays, ...nextThreeDays].sort((a, b) => a.getTime() - b.getTime());
	};

	const editSession = async (session: esession) => {
		router.push(`/workspace/${router.query.id}/sessions/${session.sessionType.id}/edit`);
	};

	const deleteSession = async (session: esession) => {
		try {
			setIsLoading(true);
			const res = await axios.post(`/api/workspace/${router.query.id}/sessions/manage/${session.sessionType.id}/delete`, {});
			setSessionsData(sessionsData.filter((s) => s.id !== session.id));
			toast.success('Session deleted successfully');
		} catch (error: any) {
			toast.error(error.response?.data?.error || 'Failed to delete session');
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const activeSessions = sessionsData.filter((session) => {
			return session.Days.includes(selectedDate.getDay());
		});

		const sortedSessions = [...activeSessions].sort((a, b) => {
			if (sortBy === 'time') {
				const timeA = a.Hour * 60 + a.Minute;
				const timeB = b.Hour * 60 + b.Minute;
				return timeA - timeB;
			} else {
				return a.sessionType.name.localeCompare(b.sessionType.name);
			}
		});

		setActiveSessions(sortedSessions);
	}, [selectedDate, sessionsData, sortBy]);

	const getDates = (dates: number[]) => {
		if (dates.length === 7) return "Everyday";
		if (dates.length === 5 && !dates.includes(0) && !dates.includes(6)) return "Weekdays";
		if (dates.length === 2 && dates.includes(0) && dates.includes(6)) return "Weekends";
		return "on " + dates.map((date) => {
			switch (date) {
				case 0: return "Sun";
				case 1: return "Mon";
				case 2: return "Tue";
				case 3: return "Wed";
				case 4: return "Thu";
				case 5: return "Fri";
				case 6: return "Sat";
				default: return "";
			}
		}).join(", ");
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<Toaster position="bottom-center" />
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="flex items-center gap-3 mb-8">
					<button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
						<IconArrowLeft className="w-5 h-5" />
					</button>
					<h1 className="text-2xl font-medium text-gray-900 dark:text-white">Sessions</h1>
				</div>

				<div className="mb-8">
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center gap-3">
							<div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-lg">
								<IconCalendarEvent className="w-5 h-5 text-primary" />
							</div>
							<div>
								<h2 className="text-lg font-medium text-gray-900 dark:text-white">Session Schedules</h2>
								<p className="text-sm text-gray-500 dark:text-gray-400">Manage and organize your session schedules</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-2">
								<label htmlFor="sort" className="text-sm text-gray-500 dark:text-gray-400">Sort by:</label>
								<select
									id="sort"
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value as 'time' | 'name')}
									className="text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:ring-primary focus:border-primary"
								>
									<option value="time">Time</option>
									<option value="name">Name</option>
								</select>
							</div>
							<button
								onClick={() => router.push(`/workspace/${router.query.id}/sessions/new`)}
								className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
							>
								<IconPlus className="w-4 h-4 mr-2" />
								New Session Type
							</button>
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
						{/* Date Selection */}
						<div className="lg:col-span-3">
							<div className="bg-white dark:bg-gray-800 rounded-lg shadow">
								<div className="p-4 border-b border-gray-200 dark:border-gray-700">
									<h3 className="text-sm font-medium text-gray-900 dark:text-white">Select Date</h3>
								</div>
								<div className="p-4 space-y-2">
									{getLastThreeDays().map((day, i) => (
										<button
											key={i}
											onClick={() => setSelectedDate(day)}
											className={`w-full px-4 py-3 rounded-lg text-left transition-colors ${
												selectedDate.getDate() === day.getDate()
													? 'bg-primary/10 text-primary dark:bg-primary/20'
													: 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
											}`}
										>
											<div className="font-medium">{day.toLocaleDateString("en-US", { weekday: "long" })}</div>
											<div className="text-sm opacity-75">{day.toLocaleDateString()}</div>
										</button>
									))}
								</div>
							</div>
						</div>

						{/* Sessions List */}
						<div className="lg:col-span-9">
							{activeSessions.length > 0 ? (
								<div className="space-y-4">
									{activeSessions.map((session) => {
										const date = new Date(selectedDate);
										date.setUTCMinutes(session.Minute);
										date.setUTCHours(session.Hour);

										return (
											<div key={session.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow transition-shadow">
												<div className="p-6">
													<div className="flex items-center justify-between">
														<div>
															<h3 className="text-lg font-medium text-gray-900 dark:text-white">
																{session.sessionType.name}
															</h3>
															<p className="text-sm text-gray-500 dark:text-gray-400">
																{getDates(session.Days)} at {moment(date).format('hh:mm A')}
															</p>
														</div>
														<div className="flex items-center gap-2">
															<button
																onClick={() => editSession(session)}
																disabled={isLoading}
																className="p-2 text-gray-500 hover:text-primary dark:hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
																aria-label="Edit session"
															>
																<IconEdit className="w-5 h-5" />
															</button>
															<button
																onClick={() => deleteSession(session)}
																disabled={isLoading}
																className="p-2 text-red-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
																aria-label="Delete session"
															>
																<IconTrash className="w-5 h-5" />
															</button>
														</div>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
									<div className="mx-auto w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center mb-4">
										<IconCalendarEvent className="w-6 h-6 text-primary" />
									</div>
									<h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">No Sessions Scheduled</h3>
									<p className="text-sm text-gray-500 dark:text-gray-400">There are no sessions scheduled for this date.</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

Home.layout = Workspace;

export default Home;
