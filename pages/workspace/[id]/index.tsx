import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Workspace from "@/layouts/workspace";
import Sessions from "@/components/home/sessions";
import Docs from "@/components/home/docs";
import randomText from "@/utils/randomText";
import wall from "@/components/home/wall";
import StickyNoteAnnouncement from "@/components/sticky-note-announcement";
import { useRecoilState } from "recoil";
import { useMemo } from "react";
import { useEffect, useState } from "react";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { withSessionSsr } from "@/lib/withSession";
import { IconHome, IconWall, IconFileText, IconSpeakerphone, IconPinned } from "@tabler/icons";
import clsx from 'clsx';

interface WidgetConfig {
	component: React.FC;
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
}

const Home: pageWithLayout = () => {
	const [login, setLogin] = useRecoilState(loginState);
	const [workspace, setWorkspace] = useRecoilState(workspacestate);
	const text = useMemo(() => randomText(login.displayname), [login.displayname]);

	const widgets: Record<string, WidgetConfig> = {
		'wall': {
			component: wall,
			icon: IconWall,
			title: 'Wall',
			description: 'Latest messages and announcements'
		},
		'sessions': {
			component: Sessions,
			icon: IconSpeakerphone,
			title: 'Sessions',
			description: 'Ongoing and upcoming sessions'
		},
		'documents': {
			component: Docs,
			icon: IconFileText,
			title: 'Documents',
			description: 'Latest workspace documents'
		},
	}

	const [isLoadingTitle, setIsLoadingTitle] = useState(false);

	useEffect(() => {
		if (typeof window !== "undefined") {
			setIsLoadingTitle(document.title.includes("Loading"));
		}
	}, []);


	return (
		<div className="pagePadding">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-medium text-gray-900 dark:text-white mb-6"><strong>{text}</strong></h1>
					<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Here's what's happening in your workspace
					</p>
				</div>
				
				{/* Sticky Note Announcement */}
				
				<div className="mb-8 z-0 relative">
					<StickyNoteAnnouncement />
				</div>

				{workspace.settings.widgets.length > 0 ? (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{workspace.settings.widgets.map((widget) => {
							const widgetConfig = widgets[widget];
							if (!widgetConfig) return null;
							const Widget = widgetConfig.component;
							const Icon = widgetConfig.icon;
							return (
								<div key={widget} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
									<div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
												<Icon className="w-5 h-5 text-primary" />
											</div>
											<div>
												<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
													{widgetConfig.title}
												</h2>
												<p className="text-sm text-gray-500 dark:text-gray-400">
													{widgetConfig.description}
												</p>
											</div>
										</div>
									</div>

									<div className="p-6">
										<Widget />
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
						<div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
							<IconHome className="w-12 h-12 text-primary" />
						</div>

						{isLoadingTitle ? (
							<h3 className="text-lg font-medium text-gray-900 dark:text-white">
								Hold on... your workspace is still loading or we're pushing an update 😋
							</h3>
						) : (
							<>
								<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
									Your dashboard is empty
								</h3>
								<p className="text-gray-500 dark:text-gray-400 mb-6">
									Add widgets to your workspace to get started
								</p>
								<button onClick={() => window.location.href = `/workspace/${workspace.groupId}/settings`} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
									Configure Dashboard
								</button>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

Home.layout = Workspace;

export default Home;
