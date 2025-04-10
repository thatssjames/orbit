import Activity from "@/components/profile/activity";
import Book from "@/components/profile/book";
import Notices from "@/components/profile/notices";
import workspace from "@/layouts/workspace";
import { pageWithLayout } from "@/layoutTypes";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import { withSessionSsr } from "@/lib/withSession";
import { loginState } from "@/state";
import { Tab } from "@headlessui/react";
import { getDisplayName, getUsername, getThumbnail } from "@/utils/userinfoEngine";
import { ActivitySession, Quota } from "@prisma/client";
import prisma from "@/utils/database";
import moment from "moment";
import { InferGetServerSidePropsType } from "next";
import { useRecoilState } from "recoil";
import { IconUserCircle, IconHistory, IconBell, IconBook } from "@tabler/icons";
import { useRouter } from "next/router";
import { useState } from "react";

export const getServerSideProps = withPermissionCheckSsr(
	async ({ query, req }) => {
		const userTakingAction = await prisma.user.findFirst({
			where: {
				userid: BigInt(query.uid as string)
			},
			include: {
				roles: {
					where: {
						workspaceGroupId: parseInt(query.id as string)
					},
					include: {
						assignedQuotas: true
					}
				}
			}
		});

		if (!userTakingAction) return { notFound: true };

		if (!parseInt(query?.id as string) && !userTakingAction?.roles[0]?.isOwnerRole && !userTakingAction?.roles[0]?.permissions?.includes('manage_activity')) return { notFound: true };
		
		const notices = await prisma.inactivityNotice.findMany({
			where: {
				userId: BigInt(query?.uid as string),
				workspaceGroupId: parseInt(query?.id as string),
			},
			orderBy: [
				{
					startTime: "desc"
				}
			]
		});

		const sessions = await prisma.activitySession.findMany({
			where: {
				userId: BigInt(query?.uid as string),
				active: false
			},
			include: {
				user: {
					select: {
						picture: true
					}
				}
			},
			orderBy: {
				endTime: "desc"
			}
		});

		var sumOfMs: number[] = [];
		var timeSpent: number;

		sessions.forEach((session: ActivitySession) => {
			sumOfMs.push(session.endTime?.getTime() as number - session.startTime.getTime());
		});

		if(sumOfMs.length) timeSpent = sumOfMs.reduce((p, c) => p + c);
		else timeSpent = 0;
		timeSpent = Math.round(timeSpent / 60000);
		
		moment.locale("es")

		const startOfWeek = moment().startOf("week").toDate();
		const endOfWeek = moment().endOf("week").toDate();

		const weeklySessions = await prisma.activitySession.findMany({
			where: {
				active: false,
				userId: BigInt(query?.uid as string),
				startTime: {
					lte: endOfWeek,
					gte: startOfWeek
				}
			},
			orderBy: {
				startTime: "asc"
			}
		});

		type Day = {
			day: number;
			ms: number[];
		}

		const days: Day[] = [
			{
				day: 1,
				ms: []
			},
			{
				day: 2,
				ms: []
			},
			{
				day: 3,
				ms: []
			},
			{
				day: 4,
				ms: []
			},
			{
				day: 5,
				ms: []
			},
			{
				day: 6,
				ms: []
			},
			{
				day: 0,
				ms: []
			}
		];

		weeklySessions.forEach((session: ActivitySession) => {
			const day = session.startTime.getDay();
			const calc = Math.round((session.endTime?.getTime() as number - session.startTime.getTime()) / 60000);
			days.find(x => x.day == day)?.ms.push(calc);
		});

		const data: number[] = [];

		days.forEach((day) => {
			if(day.ms.length < 1) return data.push(0);
			data.push(day.ms.reduce((p, c) => p + c));
		});

		const ubook = await prisma.userBook.findMany({
			where: {
				userId: BigInt(query?.uid as string)
			},
			include: {
				admin: {
					select: {
						userid: true,
						username: true,

					}
				}
			},
			orderBy: {
				createdAt: "desc"
			}
		});
		
		const sessionsAttended = await prisma.sessionUser.findMany({
			where: {
				userid: BigInt(query?.uid as string),
				session: {
					ended: {
						not: null
					}
				}
			},
		});

		const sessisonsHosted = await prisma.session.findMany({
			where: {
				ownerId: BigInt(query?.uid as string),
				ended: {
					not: null
				}
			}
		});

		return {
			props: {
				notices: (JSON.parse(JSON.stringify(notices, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))) as typeof notices),
				timeSpent,
				timesPlayed: sessions.length,
				data,
				sessions: (JSON.parse(JSON.stringify(sessions, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))) as typeof sessions),
				info: {
					username: await getUsername(Number(query?.uid as string)),
					displayName: await getDisplayName(Number(query?.uid as string)),
					avatar: await getThumbnail(Number(query?.uid as string))
				},
				isUser: req.session.userid === Number(query?.uid as string),
				sessisonsHosted: sessisonsHosted.length,
				sessionsAttended: sessionsAttended.length,
				quotas: userTakingAction?.roles[0].assignedQuotas,
				userBook: (JSON.parse(JSON.stringify(ubook, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))) as typeof ubook)
			}
		};
	}
)

type pageProps = {
	notices: any;
	timeSpent: number;
	timesPlayed: number;
	data: number[];
	sessions: (ActivitySession & {
		user: {
			picture: string | null;
		};
	})[];
	info: {
		username: string;
		displayName: string;
		avatar: string;
	}
	userBook: any;
	quotas: Quota[];
	sessionsHosted: number;
	sessionsAttended: number;
	isUser: boolean;
}
const Profile: pageWithLayout<pageProps> = ({ notices, timeSpent, timesPlayed, data, sessions, userBook: initialUserBook, isUser, info, sessionsHosted, sessionsAttended, quotas }) => {
	const [login, setLogin] = useRecoilState(loginState);
	const [userBook, setUserBook] = useState(initialUserBook);
	const router = useRouter();

	const refetchUserBook = async () => {
		try {
			const response = await fetch(`/api/workspace/${router.query.id}/userbook/${router.query.uid}`);
			const data = await response.json();
			setUserBook(data.userBook);
		} catch (error) {
			console.error("Error refetching userbook:", error);
		}
	};

	return <div className="pagePadding">
		<div className="max-w-7xl mx-auto">
			<div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
				<div className="flex items-center gap-4">
					<div className="relative">
						<img 
							src={info.avatar} 
							className="rounded-xl bg-primary h-20 w-20 object-cover" 
							alt={`${info.displayName}'s avatar`} 
						/>
						<div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-lg flex items-center justify-center">
							<IconUserCircle className="w-4 h-4 text-white" />
						</div>
					</div>
					<div>
						<h1 className="text-2xl font-medium text-gray-900 dark:text-white">{info.displayName}</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400">@{info.username}</p>
					</div>
				</div>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
				<Tab.Group>
					<Tab.List className="flex p-1 gap-1 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
						<Tab className={({ selected }) =>
							`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
								selected 
									? "bg-white dark:bg-gray-800 text-primary shadow-sm" 
									: "text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
							}`
						}>
							<IconHistory className="w-4 h-4" />
							Activity
						</Tab>
						<Tab className={({ selected }) =>
							`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
								selected 
									? "bg-white dark:bg-gray-800 text-primary shadow-sm" 
									: "text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
							}`
						}>
							<IconBook className="w-4 h-4" />
							Userbook
						</Tab>
						<Tab className={({ selected }) =>
							`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
								selected 
									? "bg-white dark:bg-gray-800 text-primary shadow-sm" 
									: "text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
							}`
						}>
							<IconBell className="w-4 h-4" />
							Notices
						</Tab>
					</Tab.List>
					<Tab.Panels className="p-6 bg-white dark:bg-gray-800 rounded-b-xl">
						<Tab.Panel>
							<Activity
								timeSpent={timeSpent}
								timesPlayed={timesPlayed}
								data={data}
								quotas={quotas}
								sessionsHosted={sessionsHosted}
								sessionsAttended={sessionsAttended}
								avatar={info.avatar}
								sessions={sessions}
								notices={notices}
							/>
						</Tab.Panel>
						<Tab.Panel>
							<Book userBook={userBook} onRefetch={refetchUserBook} />
						</Tab.Panel>
						<Tab.Panel>
							<Notices notices={notices} />
						</Tab.Panel>
					</Tab.Panels>
				</Tab.Group>
			</div>
		</div>
	</div>;
}

Profile.layout = workspace

export default Profile