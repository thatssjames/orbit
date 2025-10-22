"use client"

import type React from "react"
import type { pageWithLayout } from "@/layoutTypes"
import { loginState, workspacestate } from "@/state"
import Button from "@/components/button"
import Input from "@/components/input"
import { v4 as uuidv4 } from "uuid"
import Workspace from "@/layouts/workspace"
import { useRecoilState } from "recoil"
import { useEffect, useState } from "react"
import { Listbox } from "@headlessui/react"
import {
  IconCheck,
  IconChevronDown,
  IconPlus,
  IconTrash,
  IconInfoCircle,
  IconAlertCircle,
  IconCalendarEvent,
  IconUsers,
  IconClipboardList,
  IconUserPlus,
  IconArrowLeft,
  IconDeviceFloppy,
} from "@tabler/icons-react"
import { withPermissionCheckSsr } from "@/utils/permissionsManager"
import * as noblox from "noblox.js"
import { useRouter } from "next/router"
import axios from "axios"
import prisma from "@/utils/database"
import Switchcomponenet from "@/components/switch"
import { useForm, FormProvider } from "react-hook-form"
import type { GetServerSideProps, InferGetServerSidePropsType } from "next"

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(async (context) => {
  const { id } = context.query

  let games: Array<{ name: string; id: number }> = []
  let fallbackToManual = false

  try {
    const fetchedGames = await noblox.getGroupGames(Number(id))
    games = fetchedGames.map((game) => ({
      name: game.name,
      id: game.id,
    }))
  } catch (err) {
    console.error("Failed to fetch games from noblox:", err)
    fallbackToManual = true
  }

  const roles = await prisma.role.findMany({
    where: {
      workspaceGroupId: Number(id)
    },
    orderBy: {
      isOwnerRole: 'desc'
    }
  })

  return {
    props: {
      games,
      roles,
      fallbackToManual,
    },
  }
}, "manage_sessions")

const Home: pageWithLayout<InferGetServerSidePropsType<GetServerSideProps>> = ({ games, roles, fallbackToManual }) => {
  const [login, setLogin] = useRecoilState(loginState)
  const [activeTab, setActiveTab] = useState("basic")
  const [enabled, setEnabled] = useState(false)
  const [days, setDays] = useState<string[]>([])
  const form = useForm({
    mode: "onChange",
  })
  const [workspace, setWorkspace] = useRecoilState(workspacestate)
  const [allowUnscheduled, setAllowUnscheduled] = useState(false)
  const [selectedGame, setSelectedGame] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [frequency, setFrequency] = useState("weekly")
  const [unscheduledDate, setUnscheduledDate] = useState("")
  const [unscheduledTime, setUnscheduledTime] = useState("")
  const [statues, setStatues] = useState<
    {
      name: string
      timeAfter: number
      color: string
      id: string
    }[]
  >([])
  const [slots, setSlots] = useState<
    {
      name: string
      slots: number
      id: string
    }[]
  >([
    {
      name: "Co-Host",
      slots: 1,
      id: uuidv4(),
    },
  ])
  const router = useRouter()

  const createSession = async () => {
    setIsSubmitting(true)
    setFormError("")

    try {
      const timeValue = form.getValues().time || "00:00";
      const [localHours, localMinutes] = timeValue.split(':').map(Number);
      const selectedDays: number[] = days.map((day) => {
        const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return dayMap.indexOf(day);
      });

      const sessionTypeResponse = await axios.post(`/api/workspace/${workspace.groupId}/sessions/manage/new`, {
        name: form.getValues().name,
        description: form.getValues().description,
        gameId: fallbackToManual ? form.getValues().gameId : selectedGame,
        schedule: {
          enabled,
          days: selectedDays,
          hours: localHours,
          minutes: localMinutes,
          allowUnscheduled,
        },
        slots,
        statues,
        permissions: selectedRoles,
      })

      const createdSessionType = sessionTypeResponse.data.session;

      if (enabled && selectedDays.length > 0) {
        await axios.post(`/api/workspace/${workspace.groupId}/sessions/create-scheduled`, {
          sessionTypeId: createdSessionType.id,
          name: form.getValues().name,
          type: form.getValues().type,
          schedule: {
            days: selectedDays,
            hours: localHours,
            minutes: localMinutes,
            frequency: frequency,
          },
          timezoneOffset: new Date().getTimezoneOffset(),
        });
      }

      if (allowUnscheduled && unscheduledDate && unscheduledTime) {
        await axios.post(`/api/workspace/${workspace.groupId}/sessions/create-unscheduled`, {
          sessionTypeId: createdSessionType.id,
          name: form.getValues().name,
          type: form.getValues().type,
          date: unscheduledDate,
          time: unscheduledTime,
          timezoneOffset: new Date().getTimezoneOffset(),
        });
      }

      router.push(`/workspace/${workspace.groupId}/sessions?refresh=true`)
    } catch (err: any) {
      setFormError(err?.response?.data?.error || "Failed to create session. Please try again.")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  }

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const newStatus = () => {
    setStatues((prev) => [
      ...prev,
      {
        name: "New status",
        timeAfter: 0,
        color: "green",
        id: uuidv4(),
      },
    ])
  }

  const deleteStatus = (id: string) => {
    setStatues((prev) => prev.filter((status) => status.id !== id))
  }

  const updateStatus = (id: string, name: string, color: string, timeafter: number) => {
    setStatues((prev) =>
      prev.map((status) => (status.id === id ? { ...status, name, color, timeAfter: timeafter } : status)),
    )
  }

  const newSlot = () => {
    setSlots((prev) => [
      ...prev,
      {
        name: "Co-Host",
        slots: 1,
        id: uuidv4(),
      },
    ])
  }

  const deleteSlot = (id: string) => {
    setSlots((prev) => prev.filter((slot) => slot.id !== id))
  }

  const updateSlot = (id: string, name: string, slotsAvailble: number) => {
    setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, slots: slotsAvailble, name } : slot)))
  }

  const tabs = [
    { id: "basic", label: "Basic Info", icon: <IconInfoCircle size={18} /> },
    { id: "scheduling", label: "Scheduling", icon: <IconCalendarEvent size={18} /> },
    { id: "permissions", label: "Permissions", icon: <IconUsers size={18} /> },
    { id: "statuses", label: "Statuses", icon: <IconClipboardList size={18} /> },
    { id: "slots", label: "Slots", icon: <IconUserPlus size={18} /> },
  ]

  const isFormValid = () => {
    if (!form.getValues().name) return false
    if (!form.getValues().type) return false
    if (fallbackToManual && !form.getValues().gameId) return false
    if (!allowUnscheduled && !enabled) return false
    if (allowUnscheduled && enabled) return false
    if (enabled && !form.getValues().time) return false
    if (enabled && days.length === 0) return false
    if (allowUnscheduled && (!unscheduledDate || !unscheduledTime)) return false

    return true
  }

  const getCompletionStatus = () => {
    let completed = 0
    const total = 5

    if (form.getValues().name && (selectedGame || (fallbackToManual && form.getValues().gameId))) {
      completed++
    }
    completed++
    completed++
    completed++
    completed++

    return Math.round((completed / total) * 100)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold dark:text-white">Create New Session</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Set up a new session for your group's activities</p>
        </div>
      </div>

      {/* Error message */}
      {formError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 dark:bg-red-900/20 dark:border-red-800">
          <IconAlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
          <div>
            <h3 className="font-medium text-red-800 dark:text-red-400">Error</h3>
            <p className="text-red-600 dark:text-red-300 text-sm">{formError}</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex space-x-1 min-w-max border-b border-gray-200 dark:border-zinc-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary dark:border-primary dark:text-primary"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <FormProvider {...form}>
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden">
          {/* Basic Info */}
          {activeTab === "basic" && (
            <div className="p-6">
              <div className="flex items-start mb-6">
                <div className="bg-primary/10 p-2 rounded-lg mr-4">
                  <IconInfoCircle className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold dark:text-white">Basic Information</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                    Enter the essential details about your session type
                  </p>
                </div>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div>
                  <Input
                    {...form.register("name", {
                      required: { value: true, message: "Session name is required" },
                    })}
                    label="Session Name"
                    placeholder="Weekly Training Session"
                  />
                  {form.formState.errors.name && (
                    <p className="mt-1 text-sm text-red-500">{form.formState.errors.name.message as string}</p>
                  )}
                </div>

                <div>
                  <Input
                    {...form.register("description")}
                    label="Description"
                    textarea
                    placeholder="Describe what this session is about, what will happen, and any special instructions..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Session Type
                  </label>
                  <select
                    {...form.register("type", {
                      required: { value: true, message: "Session type is required" },
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-zinc-700 dark:text-white">
                    <option value="">Select type...</option>
                    <option value="shift">Shift</option>
                    <option value="training">Training</option>
                    <option value="event">Event</option>
                    <option value="other">Other</option>
                  </select>
                  {form.formState.errors.type && (
                    <p className="mt-1 text-sm text-red-500">{form.formState.errors.type.message as string}</p>
                  )}
                </div>

                {games.length > 0 ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Game</label>
                    <Listbox as="div" className="relative">
                      <Listbox.Button className="flex items-center justify-between w-full px-4 py-2.5 text-left bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-sm">
                        <span className="block truncate text-zinc-700 dark:text-white">
                          {games?.find((game: { name: string; id: number }) => game.id === Number(selectedGame))
                            ?.name || "Select a game"}
                        </span>
                        <IconChevronDown size={18} className="text-zinc-500 dark:text-zinc-400" />
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-10 w-full mt-1 overflow-auto bg-white dark:bg-zinc-800 rounded-lg shadow-lg max-h-60 ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {games.map((game: { name: string; id: number }) => (
                          <Listbox.Option
                            key={game.id}
                            value={game.id}
                            onClick={() => setSelectedGame(game.id.toString())}
                            className={({ active }) =>
                              `${
                                active ? "bg-primary/10 text-primary" : "text-zinc-900 dark:text-white"
                              } cursor-pointer select-none relative py-2.5 pl-10 pr-4`
                            }
                          >
                            {({ selected, active }) => (
                              <>
                                <span className={`${selected ? "font-medium" : "font-normal"} block truncate`}>
                                  {game.name}
                                </span>
                                {selectedGame === game.id.toString() && (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                                    <IconCheck size={18} aria-hidden="true" />
                                  </span>
                                )}
                              </>
                            )}
                          </Listbox.Option>
                        ))}
                        <div className="h-[1px] rounded-xl w-full px-3 bg-zinc-200 dark:bg-zinc-700" />
                        <Listbox.Option
                          value="None"
                          onClick={() => setSelectedGame("")}
                          className={({ active }) =>
                            `${
                              active ? "bg-primary/10 text-primary" : "text-zinc-900 dark:text-white"
                            } cursor-pointer select-none relative py-2.5 pl-10 pr-4`
                          }
                        >
                          {({ selected, active }) => (
                            <>
                              <span className={`${selected ? "font-medium" : "font-normal"} block truncate`}>None</span>
                              {selectedGame === "" && (
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                                  <IconCheck size={18} aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                      </Listbox.Options>
                    </Listbox>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Select the game where this session will take place
                    </p>
                  </div>
                ) : (
                  <div>
                    <Input
                      {...form.register("gameId", {
                        required: { value: true, message: "Game ID is required when games cannot be fetched" },
                        pattern: {
                          value: /^[0-9]+$/,
                          message: "Invalid Game ID format",
                        },
                      })}
                      label="Game ID"
                      placeholder="Enter your game ID manually"
                    />
                    {form.formState.errors.gameId && (
                      <p className="mt-1 text-sm text-red-500">{form.formState.errors.gameId.message as string}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onPress={() => setActiveTab("scheduling")}
                  classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"
                >
                  Continue to Scheduling
                </Button>
              </div>
            </div>
          )}

          {/* Scheduling */}
          {activeTab === "scheduling" && (
            <div className="p-6">
              <div className="flex items-start mb-6">
                <div className="bg-primary/10 p-2 rounded-lg mr-4">
                  <IconCalendarEvent className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold dark:text-white">Scheduling Options</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                    Configure when and how often sessions will occur
                  </p>
                </div>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <div className="flex flex-col space-y-3">
                    <Switchcomponenet
                      label="Unscheduled session"
                      checked={allowUnscheduled}
                      onChange={() => {
                        if (!allowUnscheduled && enabled) {
                          setEnabled(false);
                        }
                        setAllowUnscheduled(!allowUnscheduled);
                      }}
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 ml-10">
                      Enable this to set up a one time session
                    </p>

                    <div className="mt-2">
                      <Switchcomponenet
                        label="Scheduled session"
                        checked={enabled}
                        onChange={() => {
                          if (!enabled && allowUnscheduled) {
                            setAllowUnscheduled(false);
                          }
                          setEnabled(!enabled);
                        }}
                      />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 ml-10">
                        Enable this to set up recurring sessions on a schedule
                      </p>
                    </div>
                  </div>
                </div>

                {allowUnscheduled && (
                  <div className="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 space-y-4">
                    <h3 className="text-lg font-medium dark:text-white">Unscheduled Session</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Set the date and time for your single session
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Session Date
                        </label>
                        <input
                          type="date"
                          value={unscheduledDate}
                          onChange={(e) => setUnscheduledDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary dark:bg-zinc-700 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Session Time
                        </label>
                        <input
                          type="time"
                          value={unscheduledTime}
                          onChange={(e) => setUnscheduledTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary dark:bg-zinc-700 dark:text-white"
                        />
                      </div>
                    </div>
                    
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Enter date and time in your local timezone. This will create a single session at the specified date and time.
                    </p>
                  </div>
                )}

                {enabled && (
                  <div className="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 space-y-6">
                    <div>
                      <h3 className="text-lg font-medium dark:text-white mb-3">Frequency</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                        Choose how often this session repeats
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: "weekly", label: "Weekly" },
                          { value: "biweekly", label: "Bi-weekly" },
                          { value: "monthly", label: "Monthly" }
                        ].map((freq) => (
                          <button
                            key={freq.value}
                            type="button"
                            onClick={() => setFrequency(freq.value)}
                            className={`py-3 px-4 rounded-lg transition-all text-center ${
                              frequency === freq.value
                                ? "bg-primary text-white"
                                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                            }`}
                          >
                            {freq.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium dark:text-white mb-3">Repeating Days</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                        Select which days of the week this session will repeat
                      </p>

                      <div className="grid grid-cols-7 gap-2">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`py-3 rounded-lg transition-all ${
                              days.includes(day)
                                ? "bg-primary text-white"
                                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                      
                      {days.length > 0 && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                          Selected: {days.join(", ")}
                        </p>
                      )}
                    </div>

                    <div>
                      <Input
                        {...form.register("time", {
                          required: {
                            value: enabled,
                            message: "Time is required for scheduled sessions",
                          },
                        })}
                        label="Session Time"
                        type="time"
                      />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Set the time in your local timezone. Will be displayed in local time on the calendar.
                      </p>
                      {form.formState.errors.time && (
                        <p className="mt-1 text-sm text-red-500">{form.formState.errors.time.message as string}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-between w-full">
                <Button
                  onPress={() => setActiveTab("basic")}
                  classoverride="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
                >
                  Back
                </Button>
                <Button
                  onPress={() => setActiveTab("permissions")}
                  classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"
                >
                  Continue to Permissions
                </Button>
              </div>
            </div>
          )}

          {/* Permissions */}
          {activeTab === "permissions" && (
            <div className="p-6">
              <div className="flex items-start mb-6">
                <div className="bg-primary/10 p-2 rounded-lg mr-4">
                  <IconUsers className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold dark:text-white">Permissions</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                    Control which roles can host and claim these sessions
                  </p>
                </div>
              </div>

              <div className="max-w-2xl">
                <div className="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <h3 className="text-md font-medium dark:text-white mb-3">Roles that can host/claim sessions</h3>

                  {roles.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto p-2">
                      {roles.map((role: any) => (
                        <div
                          key={role.id}
                          className={`flex items-center p-2 rounded-md ${
                            selectedRoles.includes(role.id)
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-700"
                          }`}
                        >
                          <input
                            id={`role-${role.id}`}
                            type="checkbox"
                            checked={selectedRoles.includes(role.id)}
                            onChange={() => toggleRole(role.id)}
                            className="w-4 h-4 text-primary bg-zinc-100 rounded border-gray-300 focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-zinc-700 dark:border-zinc-600"
                          />
                          <label
                            htmlFor={`role-${role.id}`}
                            className="ml-2 text-sm font-medium text-zinc-900 dark:text-zinc-300 cursor-pointer w-full"
                          >
                            {role.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
                      <p className="text-zinc-500 dark:text-zinc-400">No roles available</p>
                      <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                        Create roles in your workspace settings first
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
                    {selectedRoles.length === 0
                      ? "No roles selected. Only workspace owners will be able to host sessions."
                      : `${selectedRoles.length} role(s) selected`}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-between w-full">
                <Button
                  onPress={() => setActiveTab("scheduling")}
                  classoverride="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
                >
                  Back
                </Button>
                <Button
                  onPress={() => setActiveTab("statuses")}
                  classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"
                >
                  Continue to Statuses
                </Button>
              </div>
            </div>
          )}


          {/* Statuses */}
          {activeTab === "statuses" && (
            <div className="p-6">
              <div className="flex items-start mb-6">
                <div className="bg-primary/10 p-2 rounded-lg mr-4">
                  <IconClipboardList className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold dark:text-white">Session Statuses</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                    Define status updates that occur during a session
                  </p>
                </div>
              </div>

              <div className="max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Statuses automatically update after the specified time has passed
                  </p>
                  <Button
                    onPress={newStatus}
                    compact
                    classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90 flex items-center gap-1"
                  >
                    <IconPlus size={16} /> Add Status
                  </Button>
                </div>

                {statues.length === 0 ? (
                  <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg border border-dashed border-gray-300 dark:border-zinc-600">
                    <IconClipboardList className="mx-auto text-zinc-400 dark:text-zinc-500" size={32} />
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2">No statuses added yet</p>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto">
                      Add statuses to track session progress (e.g., "Starting Soon", "In Progress", "Completed")
                    </p>
                    <Button
                      onPress={newStatus}
                      classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90 mt-4 flex items-center gap-1 mx-auto"
                    >
                      <IconPlus size={16} /> Add Your First Status
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {statues.map((status, index) => (
                      <div
                        key={status.id}
                        className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-800 shadow-sm"
                      >
                        <Status
                          updateStatus={(value, mins, color) => updateStatus(status.id, value, color, mins)}
                          deleteStatus={() => deleteStatus(status.id)}
                          data={status}
                          index={index + 1}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-between w-full">
                <Button
                  onPress={() => setActiveTab("webhooks")}
                  classoverride="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
                >
                  Back
                </Button>
                <Button
                  onPress={() => setActiveTab("slots")}
                  classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"
                >
                  Continue to Slots
                </Button>
              </div>
            </div>
          )}

          {/* Slots */}
          {activeTab === "slots" && (
            <div className="p-6">
              <div className="flex items-start mb-6">
                <div className="bg-primary/10 p-2 rounded-lg mr-4">
                  <IconUserPlus className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold dark:text-white">Session Slots</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                    Define roles and how many people can claim each role
                  </p>
                </div>
              </div>

              <div className="max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Each session has one Host by default. Add additional roles below.
                  </p>
                  <Button
                    onPress={newSlot}
                    compact
                    classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90 flex items-center gap-1"
                  >
                    <IconPlus size={16} /> Add Slot
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="border-2 border-primary/20 rounded-lg p-4 bg-primary/5 dark:bg-primary/10">
                    <Slot
                      updateStatus={() => {}}
                      isPrimary
                      deleteStatus={() => {}}
                      data={{
                        name: "Host",
                        slots: 1,
                      }}
                    />
                  </div>

                  {slots.map((slot, index) => (
                    <div
                      key={slot.id}
                      className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-800 shadow-sm"
                    >
                      <Slot
                        updateStatus={(name, openSlots) => updateSlot(slot.id, name, openSlots)}
                        deleteStatus={() => deleteSlot(slot.id)}
                        data={slot}
                        index={index + 1}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex justify-between w-full">
                <Button
                  onPress={() => setActiveTab("statuses")}
                  classoverride="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
                >
                  Back
                </Button>
                <Button
                  onPress={form.handleSubmit(createSession)}
                  disabled={isSubmitting || !isFormValid()}
                  classoverride={`flex items-center gap-1 ${
                    isFormValid()
                      ? "bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"
                      : "bg-zinc-300 text-zinc-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  <IconDeviceFloppy size={16} /> {isSubmitting ? "Creating..." : "Create Session"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </FormProvider>
    </div>
  )
}

Home.layout = Workspace

const Status: React.FC<{
  data: any
  updateStatus: (value: string, minutes: number, color: string) => void
  deleteStatus: () => void
  index?: number
}> = ({ updateStatus, deleteStatus, data, index }) => {
  const methods = useForm<{
    minutes: number
    value: string
  }>({
    defaultValues: {
      value: data.name,
      minutes: data.timeAfter,
    },
  })
  const { register, watch } = methods

  useEffect(() => {
    const subscription = methods.watch((value) => {
      updateStatus(methods.getValues().value, Number(methods.getValues().minutes), "green")
    })
    return () => subscription.unsubscribe()
  }, [methods.watch])

  return (
    <FormProvider {...methods}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          {index !== undefined && (
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium mr-2">
              {index}
            </span>
          )}
          <h3 className="font-medium dark:text-white">{watch("value") || "New Status"}</h3>
        </div>
        <Button
          onPress={deleteStatus}
          compact
          classoverride="bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 flex items-center gap-1"
        >
          <IconTrash size={16} /> Delete
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input {...register("value")} label="Status Name" placeholder="In Progress" />
        <Input {...register("minutes")} label="Time After (minutes)" type="number" placeholder="15" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 md:col-span-2">
          Status will activate {watch("minutes") || 0} minutes after session starts
        </p>
      </div>
    </FormProvider>
  )
}

const Slot: React.FC<{
  data: any
  updateStatus: (value: string, slots: number) => void
  deleteStatus: () => void
  isPrimary?: boolean
  index?: number
}> = ({ updateStatus, deleteStatus, isPrimary, data, index }) => {
  const methods = useForm<{
    slots: number
    value: string
  }>({
    defaultValues: {
      value: data.name,
      slots: data.slots,
    },
  })
  const { register, watch } = methods

  useEffect(() => {
    const subscription = methods.watch((value) => {
      updateStatus(methods.getValues().value, Number(methods.getValues().slots))
    })
    return () => subscription.unsubscribe()
  }, [methods.watch])

  return (
    <FormProvider {...methods}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          {index !== undefined && !isPrimary && (
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium mr-2">
              {index}
            </span>
          )}
          <h3 className="font-medium dark:text-white">{isPrimary ? "Host (Primary)" : watch("value") || "New Slot"}</h3>
        </div>
        {!isPrimary && (
          <Button
            onPress={deleteStatus}
            compact
            classoverride="bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 flex items-center gap-1"
          >
            <IconTrash size={16} /> Delete
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input {...register("value")} disabled={isPrimary} label="Role Name" placeholder="Co-Host" />
        <Input {...register("slots")} disabled={isPrimary} label="Available Slots" type="number" placeholder="2" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 md:col-span-2">
          {isPrimary
            ? "Primary host role cannot be changed"
            : `Number of people who can claim this role: ${watch("slots") || 0}`}
        </p>
      </div>
    </FormProvider>
  )
}

export default Home
