import type React from "react"
import type { pageWithLayout } from "@/layoutTypes"
import { loginState, workspacestate } from "@/state"
import Button from "@/components/button"
import Input from "@/components/input"
import Workspace from "@/layouts/workspace"
import { useRecoilState } from "recoil"
import { useEffect, useState } from "react"
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconTrash,
  IconAlertCircle,
  IconUserPlus,
} from "@tabler/icons-react"
import { withPermissionCheckSsr } from "@/utils/permissionsManager"
import { useRouter } from "next/router"
import axios from "axios"
import prisma from "@/utils/database"
import { useForm, FormProvider } from "react-hook-form"
import type { GetServerSideProps, InferGetServerSidePropsType } from "next"
import toast, { Toaster } from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

const BG_COLORS = [
  "bg-orange-200",
  "bg-amber-200", 
  "bg-lime-200",
  "bg-purple-200",
  "bg-violet-200",
  "bg-fuchsia-200",
  "bg-rose-200",
  "bg-green-200",
];

function getRandomBg(userid: string | number) {
  const str = String(userid);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(async (context) => {
  const { id, sid } = context.query

  try {
    const session = await prisma.session.findUnique({
      where: {
        id: sid as string
      },
      include: {
        sessionType: {
          include: {
            hostingRoles: true
          }
        },
        owner: true,
        users: {
          include: {
            user: true
          }
        }
      }
    })

    if (!session) {
      return {
        notFound: true
      }
    }

    if (session.sessionType.workspaceGroupId !== Number(id)) {
      return {
        notFound: true
      }
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
        session: JSON.parse(JSON.stringify(session, (key, value) => (typeof value === 'bigint' ? value.toString() : value))),
        roles: JSON.parse(JSON.stringify(roles, (key, value) => (typeof value === 'bigint' ? value.toString() : value))),
      },
    }
  } catch (error) {
    console.error('Error fetching session:', error)
    return {
      notFound: true
    }
  }
}, "manage_sessions")

const EditSession: pageWithLayout<InferGetServerSidePropsType<GetServerSideProps>> = ({ session, roles }) => {
  const [login, setLogin] = useRecoilState(loginState)
  const [workspace, setWorkspace] = useRecoilState(workspacestate)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteAll, setDeleteAll] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateAll, setUpdateAll] = useState(false)
  
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      date: (() => {
        const utcDate = new Date(session.date);
        const localDate = new Date(utcDate.getTime());
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const hours = String(localDate.getHours()).padStart(2, '0');
        const minutes = String(localDate.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      })(),
      description: session.sessionType.description || '',
    }
  })
  
  const router = useRouter()

  useEffect(() => {
    const loadWorkspaceUsers = async () => {
      try {
        const response = await axios.get(`/api/workspace/${router.query.id}/users`)
        setAvailableUsers(response.data)
      } catch (error) {
        console.error('Failed to load workspace users:', error)
      }
    }
    loadWorkspaceUsers()
  }, [router.query.id])

  const updateSession = async (applyToAll = false) => {
    setIsSubmitting(true)
    setFormError("")

    try {
      const formData = form.getValues()
      const localDateTime = formData.date
      const [dateStr, timeStr] = localDateTime.split('T')
      
      await axios.put(`/api/workspace/${workspace.groupId}/sessions/manage/${session.id}/manage`, {
        date: dateStr,
        time: timeStr,
        description: formData.description,
        updateAll: applyToAll,
        timezoneOffset: new Date().getTimezoneOffset(),
      })

      toast.success('Session updated successfully')
      router.push(`/workspace/${workspace.groupId}/sessions`)
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || "Failed to update session. Please try again.")
    } finally {
      setIsSubmitting(false)
      setShowUpdateModal(false)
      setUpdateAll(false)
    }
  }

  const handleSaveClick = () => {
    const isSeriesSession = session.scheduleId !== null;
    if (isSeriesSession) {
      setShowUpdateModal(true);
    } else {
      updateSession(false);
    }
  }

  const deleteSession = async () => {
    setIsSubmitting(true)
    try {
      await axios.delete(`/api/workspace/${workspace.groupId}/sessions/${session.id}/delete`, {
        data: { deleteAll }
      })
      toast.success(deleteAll ? 'All sessions in series deleted successfully' : 'Session deleted successfully')
      router.push(`/workspace/${workspace.groupId}/sessions`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to delete session")
    } finally {
      setIsSubmitting(false)
      setShowDeleteModal(false)
      setDeleteAll(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Toaster position="bottom-center" />
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold dark:text-white">Edit Session</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Modify session details and participant assignments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onPress={() => router.back()}
            classoverride="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600 flex items-center gap-1"
          >
            <IconArrowLeft size={16} /> Back
          </Button>

          <Button
            onPress={() => setShowDeleteModal(true)}
            disabled={isSubmitting}
            classoverride="bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 flex items-center gap-1"
          >
            <IconTrash size={16} /> Delete
          </Button>

          <Button
            onPress={form.handleSubmit(handleSaveClick)}
            disabled={isSubmitting}
            classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90 flex items-center gap-1"
          >
            <IconDeviceFloppy size={16} /> {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {formError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 dark:bg-red-900/20 dark:border-red-800">
          <IconAlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
          <div>
            <h3 className="font-medium text-red-800 dark:text-red-400">Error</h3>
            <p className="text-red-600 dark:text-red-300 text-sm">{formError}</p>
          </div>
        </div>
      )}

      <FormProvider {...form}>
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold dark:text-white mb-2">{session.name || session.sessionType.name}</h2>
              <div className="bg-zinc-50 dark:bg-zinc-700/30 p-4 rounded-lg space-y-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <strong>Session Type:</strong> {session.type ? session.type.charAt(0).toUpperCase() + session.type.slice(1) : 'Session'}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <strong>Original Date:</strong> {new Date(session.date).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-6 max-w-2xl">
              <div>
                <Input
                  {...form.register("date", {
                    required: { value: true, message: "Session date is required" },
                  })}
                  label="Session Date & Time"
                  type="datetime-local"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Enter date and time in your local timezone.
                </p>
                {form.formState.errors.date && (
                  <p className="mt-1 text-sm text-red-500">{form.formState.errors.date.message as string}</p>
                )}
              </div>

              <div>
                <Input
                  {...form.register("description")}
                  label="Description"
                  textarea
                  placeholder="Describe what this session is about..."
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Provide details about the session's purpose and activities.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium dark:text-white mb-4">Role Claims</h3>
                
                <div className="bg-zinc-50 dark:bg-zinc-700/30 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
                    Host
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400 w-16">
                      Slot 1:
                    </span>
                    <div className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md flex items-center gap-2">
                      {session.owner?.username ? (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${getRandomBg(session.owner.userid?.toString() || session.owner.userid || '')}`}>
                          <img
                            src={session.owner.picture || "/default-avatar.png"}
                            alt={session.owner.username}
                            className="w-6 h-6 rounded-full object-cover border border-white"
                            onError={(e) => {
                              e.currentTarget.src = "/default-avatar.png";
                            }}
                          />
                        </div>
                      ) : null}
                      <span className="text-zinc-700 dark:text-white">
                        {session.owner?.username || 'Unclaimed'}
                      </span>
                    </div>
                  </div>
                </div>

                {session.sessionType.slots && Array.isArray(session.sessionType.slots) && session.sessionType.slots.length > 0 && (
                  <div className="space-y-4">
                    {session.sessionType.slots.map((slot: any, slotIndex: number) => {
                      if (typeof slot !== 'object') return null
                      const slotData = JSON.parse(JSON.stringify(slot))
                      
                      return (
                        <div key={slotIndex} className="bg-zinc-50 dark:bg-zinc-700/30 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
                            {slotData.name}
                          </h4>
                          <div className="space-y-2">
                            {Array.from(Array(slotData.slots)).map((_, i) => {
                              const assignedUser = session.users?.find((u: any) => u.roleID === slotData.id && u.slot === i)
                              const username = assignedUser ? availableUsers.find((user: any) => user.userid === assignedUser.userid.toString())?.username : null
                              const userPicture = assignedUser ? availableUsers.find((user: any) => user.userid === assignedUser.userid.toString())?.picture : null
                              
                              return (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400 w-16">
                                    Slot {i + 1}:
                                  </span>
                                  <div className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md flex items-center gap-2">
                                    {username ? (
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${getRandomBg(assignedUser.userid.toString())}`}>
                                        <img
                                          src={userPicture || "/default-avatar.png"}
                                          alt={username}
                                          className="w-6 h-6 rounded-full object-cover border border-white"
                                          onError={(e) => {
                                            e.currentTarget.src = "/default-avatar.png";
                                          }}
                                        />
                                      </div>
                                    ) : null}
                                    <span className="text-zinc-700 dark:text-white">
                                      {username || 'Unclaimed'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </FormProvider>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 text-center">
              Confirm Deletion
            </h2>
            
            {session.scheduleId ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 text-center">
                  This is part of a recurring session series. What would you like to delete?
                </p>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/30 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteOption"
                      checked={!deleteAll}
                      onChange={() => setDeleteAll(false)}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-white">Delete only this session</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        Remove just this single occurrence on {new Date(session.date).toLocaleDateString()}
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/30 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteOption"
                      checked={deleteAll}
                      onChange={() => setDeleteAll(true)}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-white">Delete entire series</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        Remove all sessions in this recurring series
                      </div>
                    </div>
                  </label>
                </div>
                
                <div className="flex justify-center gap-4 pt-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteAll(false);
                    }}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteSession}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 min-w-[100px]"
                  >
                    {isSubmitting ? 'Deleting...' : (deleteAll ? 'Delete Series' : 'Delete Session')}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6 text-center">
                  Are you sure you want to delete this session? This action cannot be undone.
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteSession}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 text-center">
              Update Session Series
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6 text-center">
              This session is part of a recurring series. How would you like to apply these changes?
            </p>
            
            <div className="space-y-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="updateScope"
                  checked={!updateAll}
                  onChange={() => setUpdateAll(false)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">This session only</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Apply changes to this specific session instance
                  </div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="updateScope"
                  checked={updateAll}
                  onChange={() => setUpdateAll(true)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">All sessions in series</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Apply changes to all sessions in this recurring series
                  </div>
                </div>
              </label>
            </div>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setUpdateAll(false);
                }}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateSession(updateAll)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 min-w-[100px]"
              >
                {isSubmitting ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

EditSession.layout = Workspace

export default EditSession