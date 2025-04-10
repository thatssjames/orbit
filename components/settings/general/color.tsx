import axios from "axios";
import React from "react";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import { FC } from '@/types/settingsComponent';
import { IconCheck } from "@tabler/icons";
import clsx from 'clsx';

type props = {
	triggerToast: typeof toast;
	isSidebarExpanded: boolean; // Add a prop to track sidebar state
}

const Color: FC<props> = ({ triggerToast, isSidebarExpanded }) => {
	const [workspace, setWorkspace] = useRecoilState(workspacestate);

	const updateColor = async (color: string) => {
		try {
			const res = await axios.patch(`/api/workspace/${workspace.groupId}/settings/general/color`, { color });
			if (res.status === 200) {
				setWorkspace({ ...workspace, groupTheme: color });
				document.documentElement.style.setProperty('--group-theme', getRGBFromTailwindColor(color));
				triggerToast.success("Color updated successfully!");
			} else {
				triggerToast.error("Failed to update color.");
			}
		} catch (error) {
			triggerToast.error("Something went wrong.");
		}
	};

	const colors = [
		"bg-orbit", "bg-blue-500", "bg-red-500", "bg-red-700",
		"bg-green-500", "bg-green-600", "bg-yellow-500",
		"bg-orange-500", "bg-purple-500", "bg-pink-500",
		"bg-black", "bg-gray-500",
	];

	return (
		<div className={clsx("transition-all", { "ml-64": isSidebarExpanded, "ml-0": !isSidebarExpanded })}>
			<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
				Choose a color theme for your workspace
			</p>
			<div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
				{colors.map((color, i) => (
					<button
						key={i}
						onClick={() => updateColor(color)}
						className={clsx(
							'relative aspect-square rounded-lg transition-transform hover:scale-105 z-0',
							color
						)}
					>
						{workspace.groupTheme === color && (
							<div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 rounded-lg">
								<IconCheck size={16} className="text-white" />
							</div>
						)}
					</button>
				))}
			</div>
		</div>
	);
};

function getRGBFromTailwindColor(tw: string): string {
	const fallback = "0, 0, 0";
	return getComputedStyle(document.documentElement)
		.getPropertyValue(`--tw-${tw.replace('bg-', '')}`) || fallback;
}

Color.title = "Customize";

export default Color;