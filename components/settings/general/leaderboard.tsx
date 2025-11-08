import axios from "axios";
import React from "react";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import SwitchComponenet from "@/components/switch";
import { workspacestate } from "@/state";
import { FC } from '@/types/settingsComponent'
import { IconTrophy } from "@tabler/icons-react";

type props = {
	triggerToast: typeof toast;
}

const Leaderboard: FC<props> = (props) => {
	const triggerToast = props.triggerToast;
	const [workspace, setWorkspace] = useRecoilState(workspacestate);

	const updateColor = async () => {
		const res = await axios.patch(`/api/workspace/${workspace.groupId}/settings/general/leaderboard`, { 
			enabled: !workspace.settings.leaderboardEnabled
		});
		if (res.status === 200) {
			const obj = JSON.parse(JSON.stringify(workspace), (key, value) => (typeof value === 'bigint' ? value.toString() : value));
			obj.settings.leaderboardEnabled = !workspace.settings.leaderboardEnabled;
			setWorkspace(obj);
			triggerToast.success("Updated leaderboard!");
		} else {
			triggerToast.error("Failed to update leaderboard.");
		}
	};	

	return (
		<div>
			<div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
				<div className="flex items-center gap-3">
					<div className="p-2 bg-primary/10 rounded-lg">
						<IconTrophy size={20} className="text-primary" />
					</div>
					<div>
						<p className="text-sm font-medium text-zinc-900 dark:text-white">Leaderboard</p>
						<p className="text-xs text-zinc-500 dark:text-zinc-400">View top performers on your workspace</p>
					</div>
				</div>
				<SwitchComponenet 
					checked={workspace.settings?.leaderboardEnabled} 
					onChange={updateColor} 
					label="" 
					classoverride="mt-0"
				/>
			</div>
		</div>
	);
};

Leaderboard.title = "Leaderboard";

export default Leaderboard;
