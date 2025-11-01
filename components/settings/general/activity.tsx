import axios from "axios";
import React, { useEffect, useState, Fragment } from "react";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import SwitchComponenet from "@/components/switch";
import { workspacestate } from "@/state";
import { Dialog, Listbox, Transition } from "@headlessui/react";
import {
  IconCheck,
  IconChevronDown,
  IconAlertTriangle,
  IconRefresh,
  IconCalendarTime,
} from "@tabler/icons-react";
import { useRouter } from "next/router";
import moment from "moment";

import { FC } from "@/types/settingsComponent";

type props = {
  triggerToast: typeof toast;
};

const Activity: FC<props> = (props) => {
  const triggerToast = props.triggerToast;
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [roles, setRoles] = React.useState([]);
  const [selectedRole, setSelectedRole] = React.useState<number>();
  const [lastReset, setLastReset] = useState<any>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const res = await axios.get(
        `/api/workspace/${router.query.id}/settings/activity/getConfig`
      );
      if (res.status === 200) {
        setRoles(res.data.roles);
        setSelectedRole(res.data.currentRole);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(
          `/api/workspace/${router.query.id}/activity/last-reset`
        );
        if (res.status === 200 && res.data.success) {
          setLastReset(res.data.lastReset);
        }
      } catch (error) {
        console.error("Error fetching last reset:", error);
      }
    })();
  }, [router.query.id]);

  const downloadLoader = async () => {
    window.open(`/api/workspace/${router.query.id}/settings/activity/download`);
  };

  const updateRole = async (id: number) => {
    const req = await axios.post(
      `/api/workspace/${workspace.groupId}/settings/activity/setRole`,
      { role: id }
    );
    if (req.status === 200) {
      setSelectedRole(
        (roles.find((role: any) => role.rank === id) as any).rank
      );
      triggerToast.success("Updated role");
    }
  };

  const resetActivity = async () => {
    setIsResetting(true);
    try {
      const res = await axios.post(
        `/api/workspace/${router.query.id}/activity/reset`
      );
      if (res.status === 200) {
        triggerToast.success("Activity has been reset!");
        setIsResetDialogOpen(false);
        const resetRes = await axios.get(
          `/api/workspace/${router.query.id}/activity/last-reset`
        );
        if (resetRes.status === 200 && resetRes.data.success) {
          setLastReset(resetRes.data.lastReset);
        }
      }
    } catch (error) {
      triggerToast.error("Failed to reset activity");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="relative z-15">
      <p className="mb-4 z-15 dark:text-zinc-400">
        Sessions are a powerful way to keep track of your groups sessions &
        shifts
      </p>
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Activity Role
        </label>
        <Listbox
          value={selectedRole}
          onChange={(value: number) => updateRole(value)}
          as="div"
          className="relative inline-block w-full text-left mb-2"
        >
          <Listbox.Button className="z-10 h-auto w-full flex flex-row rounded-xl py-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800 px-2 transition cursor-pointer outline-1 outline-gray-300 outline mb-1 focus-visible:bg-zinc-200">
            <p className="z-10 my-auto text-lg pl-2 dark:text-white">
              {(roles.find((r: any) => r.rank === selectedRole) as any)?.name ||
                "Guest"}
            </p>
            <IconChevronDown
              size={18}
              color="#AAAAAA"
              className="my-auto ml-auto"
            />
          </Listbox.Button>
          <Listbox.Options className="absolute left-0 z-10 mt-2 w-48 origin-top-left rounded-xl bg-white dark:text-white dark:bg-zinc-800 shadow-lg ring-1 ring-gray-300 focus-visible:outline-none overflow-clip">
            <div className="">
              {roles.map((role: any, index) => (
                <Listbox.Option
                  className={({ active }) =>
                    `${
                      active
                        ? "text-white bg-primary"
                        : "text-zinc-900 dark:text-white"
                    } relative cursor-pointer select-none py-2 pl-3 pr-9`
                  }
                  key={index}
                  value={role.rank}
                >
                  {({ selected, active }) => (
                    <>
                      <div className="flex items-center">
                        <span
                          className={`${
                            selected ? "font-semibold" : "font-normal"
                          } ml-2 block truncate text-lg`}
                        >
                          {role.name}
                        </span>
                      </div>

                      {selected ? (
                        <span
                          className={`${active ? "text-white" : "text-primary"}
																	absolute inset-y-0 right-0 flex items-center pr-4`}
                        >
                          <IconCheck className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </div>
          </Listbox.Options>
        </Listbox>
      </div>

      <div className="mb-6">
        <button
          onClick={downloadLoader}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
        >
          Download loader
        </button>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
              Activity Period
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Start a new activity timeframe
            </p>
          </div>
        </div>

        {lastReset && (
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <IconCalendarTime className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Last Reset
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {moment(lastReset.resetAt).format("MMMM Do, YYYY [at] h:mm A")}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              by {lastReset.resetBy?.username || "Unknown User"}
            </p>
          </div>
        )}

        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <IconAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                Warning: This action cannot be undone
              </h4>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsResetDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Reset Activity Period
        </button>
      </div>

      <Transition appear show={isResetDialogOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => !isResetting && setIsResetDialogOpen(false)}
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-6 text-left shadow-xl transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg">
                      <IconAlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <Dialog.Title className="text-lg font-medium text-zinc-900 dark:text-white">
                      Confirm Activity Reset
                    </Dialog.Title>
                  </div>

                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                    Are you sure you want to reset the activity period? This
                    will:
                  </p>

                  <ul className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 space-y-1 ml-4">
                    <li>• Save all current activity data to history</li>
                    <li>• Clear all current activity metrics</li>
                    <li>• Start a fresh activity period</li>
                  </ul>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsResetDialogOpen(false)}
                      disabled={isResetting}
                      className="flex-1 rounded-lg border border-gray-300 bg-white dark:bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={resetActivity}
                      disabled={isResetting}
                      className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {isResetting ? "Resetting..." : "Reset Activity"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

Activity.title = "Activity";
Activity.isAboveOthers = true;

export default Activity;
