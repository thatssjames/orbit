import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Button from "@/components/button";
import toast, { Toaster } from 'react-hot-toast'
import Input from "@/components/input";
import Workspace from "@/layouts/workspace";
import { v4 as uuidv4 } from "uuid";
import { useRecoilState } from "recoil";
import { useEffect, useState } from "react";
import { Listbox } from "@headlessui/react";
import { IconCheck, IconChevronDown } from "@tabler/icons";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import * as noblox from "noblox.js";
import { useRouter } from "next/router";

import axios from "axios";
import prisma from "@/utils/database";
import Switchcomponenet from "@/components/switch";

import { useForm, FormProvider } from "react-hook-form";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(async (context) => {
	const { id, sid } = context.query;
	let games: { name: string; id: number }[] = [];
	let fallbackToManual = false;
	
	try {
		const fetchedGames = await noblox.getGroupGames(Number(id));
		games = fetchedGames.map(game => ({
			name: game.name,
			id: game.id,
		}));
	} catch (err) {
		console.error("Failed to fetch games from noblox:", err);
		fallbackToManual = true;
	
	}
	const session = await prisma.sessionType.findUnique({
		where: {
			id: (sid as string)
		},
		include: {
			hostingRoles: true
		}
	});
	if (!session) {
		return {
			notFound: true
		}
	}

	const roles = await prisma.role.findMany({
		where: {
			workspaceGroupId: Number(id),
			isOwnerRole: false
		},
	});


	return {
		props: {
			games,
			roles,
			session: JSON.parse(JSON.stringify(session, (key, value) => (typeof value === 'bigint' ? value.toString() : value))),
			fallbackToManual
		},
	};


}, 'manage_sessions')

const Home: pageWithLayout<InferGetServerSidePropsType<GetServerSideProps>> = ({ games, roles, session, fallbackToManual }) => {
	const [login, setLogin] = useRecoilState(loginState);
	const [enabled, setEnabled] = useState(false);
	const [days, setDays] = useState<string[]>([])
	const [statues, setStatues] = useState<{
		name: string;
		timeAfter: number;
		color: string;
		id: string;
	}[]>(session.statues?.length ? session.statues : [])
	const [slots, setSlots] = useState<{
		name: string;
		slots: number;
		id: string;
	}[]>(session.slots || [{
		name: 'Co-Host',
		slots: 1,
		id: uuidv4()
	}])
	const form = useForm({
		defaultValues: {
			name: session.name,
			webhooksEnabled: session.webhookEnabled,
			webhookUrl: session.webhookUrl,
			webhookTitle: session.webhookTitle,
			webhookBody: session.webhookBody,
			webhookPing: session.webhookPing,
			gameId: session.gameId ?? ""
		}
	});
	const [workspace] = useRecoilState(workspacestate);
	const [allowUnscheduled, setAllowUnscheduled] = useState(session.allowUnscheduled);
	const [webhooksEnabled, setWebhooksEnabled] = useState(session.webhookEnabled);
	const [selectedGame, setSelectedGame] = useState(parseInt(session.gameId))
	const [selectedRoles, setSelectedRoles] = useState<string[]>(session.hostingRoles.map((role: any) => role.id))
	const router = useRouter();

	const toggleRole = async (role: string) => {
		const roles = selectedRoles;
		if (roles.includes(role)) {
			roles.splice(roles.indexOf(role), 1);
		}
		else {
			roles.push(role);
		}
		setSelectedRoles(roles);
	}

	const updateSession = async () => {
		const data = form.getValues();
		const res = axios.post(`/api/workspace/${workspace.groupId}/sessions/manage/${session.id}/edit`, {
			webhook: {
				enabled: webhooksEnabled,
				url: data.webhookUrl,
				title: data.webhookTitle,
				body: data.webhookBody,
				ping: data.webhookPing
			},
			statues,
			name: data.name,
			slots,
			gameId: selectedGame,
			permissions: selectedRoles
		});
		toast.promise(res, {
			loading: 'Updating session',
			success: 'Session updated',
			error: 'Failed to update session'
		}).then(() => {
			router.push(`/workspace/${workspace.groupId}/sessions/schedules`);
		})

	}

	


	useEffect(() => { }, [days]);

	const newStatus = () => {
		setStatues([...statues, {
			name: 'New status',
			timeAfter: 0,
			color: 'green',
			id: uuidv4()
		}])
	}

	const deleteStatus = (index: number) => {
		const newStatues = statues;
		newStatues.splice(index, 1);
		setStatues([...newStatues]);
	}

	const updateStatus = (id: string, name: string, color: string, timeafter: number) => {
		const newStatues = statues;
		const index = newStatues.findIndex((status) => status.id === id);
		newStatues[index] = {
			...newStatues[index],
			name,
			color,
			timeAfter: timeafter
		};
		setStatues([...newStatues]);
	}

	const newSlot = () => {
		setSlots([...slots, {
			name: 'Co-Host',
			slots: 1,
			id: uuidv4()
		}])
	}

	const deleteSlot = (index: number) => {
		const newSlots = slots;
		newSlots.splice(index, 1);
		setSlots([...newSlots]);
	}

	const updateSlot = (id: string, name: string, slotsAvailble: number) => {
		const newSlots = slots;
		const index = slots.findIndex((slot) => slot.id === id);
		newSlots[index] = {
			...newSlots[index],
			slots: slotsAvailble,
			name
		};
		setSlots([...newSlots]);
	}

	return <div className="pagePadding">
	<p className="text-4xl font-bold dark:text-white">Edit session type</p>
	<FormProvider {...form}>
		<div className="pt-5 grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-2">
			<div className="bg-white dark:bg-gray-800 p-4 border border-1 border-gray-300 dark:border-gray-700 rounded-md">
				<p className="text-2xl font-bold dark:text-white">Info</p>
				<Input
					{...form.register('name', {
						required: { value: true, message: "This field is required" }
					})}
					label="Name of session type"
				/>

				{!fallbackToManual ? (
					<Listbox as="div" className="relative inline-block text-left w-full">
						<Listbox.Button className="ml-auto bg-gray-100 px-3 py-2 w-full rounded-md font-medium text-gray-600 flex">
							<p className="my-auto">
								{games?.find((game: { id: number; name: string }) => game.id === Number(selectedGame))?.name || 'No game selected'}
							</p>
							<IconChevronDown size={20} className="text-gray-500 my-auto ml-auto" />
						</Listbox.Button>
						<Listbox.Options className="absolute right-0 z-40 mt-2 w-56 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
							<div>
								{games.map((game: any) => (
									<Listbox.Option
										key={game.id}
										value={game.id}
										onClick={() => setSelectedGame(game.id)}
										className={({ active }) =>
											`${active ? 'text-white bg-indigo-600' : 'text-gray-900'} relative cursor-pointer select-none py-2 pl-3 pr-9`
										}
									>
										{({ selected, active }) => (
											<>
												<div className="flex items-center">
													<span className={`${selected ? 'font-semibold' : 'font-normal'} ml-3 block truncate`}>
														{game.name}
													</span>
												</div>
												{selected && (
													<span className={`${active ? 'text-white' : 'text-indigo-600'} absolute inset-y-0 right-0 flex items-center pr-4`}>
														<IconCheck className="h-5 w-5" aria-hidden="true" />
													</span>
												)}
											</>
										)}
									</Listbox.Option>
								))}
							</div>
							<div className="h-[1px] rounded-xl w-full px-3 bg-gray-300" />
							<Listbox.Option
								value={'None'}
								onClick={() => setSelectedGame(0)}
								className={({ active }) =>
									`${active ? 'text-white bg-indigo-600' : 'text-gray-900'} relative cursor-pointer select-none py-2 pl-3 pr-9`
								}
							>
								{({ selected, active }) => (
									<>
										<div className="flex items-center">
											<span className={`${selected ? 'font-semibold' : 'font-normal'} ml-3 block truncate`}>
												None
											</span>
										</div>
										{selected && (
											<span className={`${active ? 'text-white' : 'text-indigo-600'} absolute inset-y-0 right-0 flex items-center pr-4`}>
												<IconCheck className="h-5 w-5" aria-hidden="true" />
											</span>
										)}
									</>
								)}
							</Listbox.Option>
						</Listbox.Options>
					</Listbox>
				) : (
					<Input
						label="Game ID"
						placeholder="Enter game ID manually"
						{...form.register("gameId", {
							required: { value: true, message: "Game ID is required" },
							pattern: {
								value: /^[0-9]+$/,
								message: "Game ID must be a number"
							}
						})}
					/>
				)}
			</div>
				<div className="bg-white dark:bg-gray-800 p-4 border border-1 border-gray-300 dark:border-gray-700  rounded-md">
					<p className="text-2xl font-bold mb-2 dark:text-white">Permissions </p>
					<p className="text-1xl font-bold mb-2 dark:text-white">Hosting/Claiming</p>
					{roles.map((role: any) => (
						<div
							className="flex items-center"
							key={role.id}
						>
							<input
								type="checkbox"
								checked={selectedRoles.includes(role.id)}
								onChange={() => toggleRole(role.id)}

								className="rounded-sm mr-2 w-4 h-4 transform transition dark:text-white text-primary bg-slate-100 border-gray-300 dark:border-gray-700 hover:bg-gray-300 focus-visible:bg-gray-300 checked:hover:bg-primary/75 checked:focus-visible:bg-primary/75 focus:ring-0"
							/>
							<p>{role.name}</p>
						</div>
					))}
				</div>
				<div className="bg-white dark:bg-gray-800 p-4 border border-1 border-gray-300 dark:border-gray-700  rounded-md">
					<p className="text-2xl font-bold mb-2 dark:text-white">Discord webhooks  </p>
					<Switchcomponenet label="Enabled" classoverride="mb-2" checked={webhooksEnabled} onChange={() => setWebhooksEnabled(!webhooksEnabled)} />
					{webhooksEnabled && (
						<>
							<Input {...form.register('webhookUrl', {
								required: {
									value: webhooksEnabled,
									message: 'Webhook is required',
								},
								pattern: {
									value: /^https?:\/\/(?:www\.)?discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([\w-]+)$/,
									message: 'Invalid webhook URL',
								}
							})} label="Webhook URL" type="text" />

							<Input {...form.register('webhookPing', {
								required: {
									value: true,
									message: 'Webhook Ping is required',
								}
							})} label="Ping" type="text" placeholder={`Session Ping [<@&id>]`} />

							<Input {...form.register('webhookTitle', {
								required: {
									value: true,
									message: 'Webhook Title is required',
								}
							})} label="Title" type="text" placeholder={`Embed Title / Session Name`} />

							<Input {...form.register('webhookBody', {
								required: {
									value: true,
									message: 'Webhook Body is required',
								}
							})} label="Text" type="text" textarea placeholder="This group is hosting a session/shift!" />
						</>
					)}




				</div>

				<div className="bg-white dark:bg-gray-800 p-4 border border-1 border-gray-300 dark:border-gray-700  rounded-md">
					<p className="text-2xl font-bold mb-2 dark:text-white">Statuses  </p>
					<Button onPress={() => newStatus()} classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"> New Status </Button>
					{statues.map((status: any, i) => (
						<div className="p-3 outline outline-gray-300 rounded-md mt-4 outline-1" key={i}><Status updateStatus={(value, mins, color) => updateStatus(status.id, value, color, mins)} deleteStatus={() => deleteStatus(status.id)} data={status} /></div>

					))}
				</div>

				<div className="bg-white dark:bg-gray-800 p-4 border border-1 border-gray-300 dark:border-gray-700  rounded-md">
					<p className="text-2xl font-bold mb-2 dark:text-white">Slots  </p>
					<Button onPress={() => newSlot()} classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"> New Slot </Button>
					<div className="p-3 outline outline-gray-300 rounded-md mt-4 outline-1"><Slot updateStatus={() => {}} isPrimary deleteStatus={() => {}} data={{
						name: 'Host',
						slots: 1
					}} /></div>
					{slots.map((status: any, i) => (
						<div className="p-3 outline outline-gray-300 rounded-md mt-4 outline-1" key={i}><Slot updateStatus={(name, openSlots) => updateSlot(status.id, name, openSlots)} deleteStatus={() => deleteSlot(status.id)} data={status} /></div>

					))}
				</div>
			</div>

		</FormProvider>
		<div className="flex mt-2">
			<Button classoverride="ml-0 bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90" onPress={() => router.back()}>Back</Button>
			<Button classoverride="ml-2 bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90" onPress={form.handleSubmit(updateSession)}>Update</Button>
		</div>
		<Toaster />

	</div>;
};

Home.layout = Workspace;

const Status: React.FC<{
	data: any
	updateStatus: (value: string, minutes: number, color: string) => void
	deleteStatus: () => void
}> = (
	{
		updateStatus,
		deleteStatus,
		data,
	}
) => {
		const methods = useForm<{
			minutes: number,
			value: string,
		}>({
			defaultValues: {
				value: data.name,
				minutes: data.timeAfter,
			}
		});
		const { register, handleSubmit, getValues, watch } = methods;
		useEffect(() => {
			const subscription = methods.watch((value) => {
				updateStatus(methods.getValues().value, Number(methods.getValues().minutes), 'green');
			});
			return () => subscription.unsubscribe();
		}, [methods.watch]);



		return (
			<FormProvider {...methods}>
				<div> <Button onPress={deleteStatus} classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90">Delete</Button> </div>
				{<Input {...register('value')} label="Status" />}
				{<Input {...register('minutes')} label="After" append="minutes" prepend={`${watch('value')?.replace('ed', '')}'s after`} type="number" />}
			</FormProvider>
		)
	}

const Slot: React.FC<{
	data: any
	updateStatus: (value: string, slots: number) => void
	deleteStatus: () => void,
	isPrimary?: boolean
}> = (
	{
		updateStatus,
		deleteStatus,
		isPrimary,
		data,
	}
) => {
		const methods = useForm<{
			slots: number,
			value: string,
		}>({
			defaultValues: {
				value: data.name,
				slots: data.slots,
			}
		});
		const { register, handleSubmit, getValues, watch } = methods;
		useEffect(() => {
			const subscription = methods.watch((value) => {
				updateStatus(methods.getValues().value, Number(methods.getValues().slots));
			});
			return () => subscription.unsubscribe();
		}, [methods.watch]);



		return (
			<FormProvider {...methods}>
				<div> <Button onClick={deleteStatus} disabled={isPrimary} classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90 disabled:opacity-5">Delete</Button> </div>
				{<Input {...register('value')} disabled={isPrimary} label="Name" />}
				{<Input {...register('slots')} disabled={isPrimary} append="people can claim" type="number" />}
			</FormProvider>
		)
	}


export default Home;
