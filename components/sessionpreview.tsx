import React, { useState, useEffect, useRef } from "react";
import {
  IconX,
  IconCalendarEvent,
  IconClock,
  IconNotes,
  IconHistory,
  IconSend,
  IconUserPlus,
  IconUserMinus,
  IconUserCheck,
} from "@tabler/icons-react";
import axios from "axios";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { useRecoilValue } from "recoil";
import { loginState } from "@/state";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { useSessionColors } from "@/hooks/useSessionColors";

interface SessionModalProps {
  session: any;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (sessionId: string) => void;
  onDelete: (sessionId: string, deleteAll?: boolean) => void;
  onUpdate?: () => void;
  workspaceMembers: any[];
  canManage: boolean;
}

const SessionModal: React.FC<SessionModalProps> = ({
  session,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onUpdate,
  workspaceMembers,
  canManage,
}) => {
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();
  const login = useRecoilValue(loginState);
  const { getSessionTypeColor, getRecurringColor, getTextColorForBackground } =
    useSessionColors(
      Array.isArray(router.query.id) ? router.query.id[0] : router.query.id
    );

  // Centralized refresh function
  const refreshSessionData = () => {
    onUpdate?.(); // Refresh session data from parent
    setRefreshKey(prev => prev + 1); // Trigger refresh of internal components
  };

  useEffect(() => {
    if (isOpen && session) {
      setAvailableUsers(workspaceMembers);
    }
  }, [isOpen, session, workspaceMembers]);

  const handleHostClaim = async (username: string) => {
    if (!canManage) return;

    try {
      setIsSubmitting(true);
      const user = username.trim()
        ? availableUsers.find(
            (u) => u.username.toLowerCase() === username.toLowerCase()
          )
        : null;

      if (username.trim() && !user) {
        toast.error(`User "${username}" not found in workspace`);
        return;
      }

      await axios.put(
        `/api/workspace/${router.query.id}/sessions/${session.id}/update-host`,
        {
          ownerId: user ? user.userid : null,
        }
      );

      await axios.post(
        `/api/workspace/${router.query.id}/sessions/${session.id}/logs`,
        {
          action: username.trim() ? "host_assigned" : "host_unassigned",
          targetId: user ? user.userid : session.ownerId,
          metadata: {},
        }
      );

      toast.success(
        username.trim()
          ? "Host assigned successfully"
          : "Host unassigned successfully"
      );
      refreshSessionData();

      session.owner = user || null;
      session.ownerId = user ? user.userid : null;
    } catch (error: any) {
      console.error("Host claim error:", error);
      toast.error(
        error?.response?.data?.error || "Failed to update host assignment"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSlotClaim = async (
    roleId: string,
    slot: number,
    username: string
  ) => {
    if (!canManage) return;

    try {
      setIsSubmitting(true);

      if (username.trim()) {
        const user = availableUsers.find(
          (u) => u.username.toLowerCase() === username.toLowerCase()
        );

        if (!user) {
          toast.error(`User "${username}" not found in workspace`);
          return;
        }

        await axios.post(
          `/api/workspace/${router.query.id}/sessions/${session.id}/claim-role`,
          {
            userId: user.userid,
            roleId,
            slot,
            action: "claim",
          }
        );

        const roleSlot = session.sessionType.slots?.find(
          (s: any) => s.id === roleId
        );
        await axios.post(
          `/api/workspace/${router.query.id}/sessions/${session.id}/logs`,
          {
            action: "role_assigned",
            targetId: user.userid,
            metadata: {
              roleName: roleSlot?.name || "Unknown Role",
              slot: slot,
            },
          }
        );

        toast.success("Role assigned successfully");
      } else {
        const currentAssignment = session.users?.find(
          (u: any) => u.roleID === roleId && u.slot === slot
        );

        await axios.post(
          `/api/workspace/${router.query.id}/sessions/${session.id}/claim-role`,
          {
            roleId,
            slot,
            action: "unclaim",
          }
        );

        if (currentAssignment) {
          const roleSlot = session.sessionType.slots?.find(
            (s: any) => s.id === roleId
          );
          await axios.post(
            `/api/workspace/${router.query.id}/sessions/${session.id}/logs`,
            {
              action: "role_unassigned",
              targetId: currentAssignment.userid,
              metadata: {
                roleName: roleSlot?.name || "Unknown Role",
                slot: slot,
              },
            }
          );
        }

        toast.success("Role unassigned successfully");
      }

      refreshSessionData();
    } catch (error: any) {
      console.error("Role claim error:", error);
      toast.error(
        error?.response?.data?.error || "Failed to update role assignment"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !session) return null;

  const sessionDate = new Date(session.date);
  const isRecurring = session.scheduleId !== null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <IconCalendarEvent className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                {session.name || session.sessionType.name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <IconClock className="w-4 h-4" />
                {sessionDate.toLocaleDateString()} at{" "}
                {sessionDate.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
                {isRecurring && (
                  <span
                    className={`${getRecurringColor()} ${getTextColorForBackground(
                      getRecurringColor()
                    )} px-2 py-1 rounded text-xs font-medium`}
                  >
                    Recurring
                  </span>
                )}
                {session.type && (
                  <span
                    className={`${getSessionTypeColor(
                      session.type
                    )} ${getTextColorForBackground(
                      getSessionTypeColor(session.type)
                    )} px-2 py-1 rounded text-xs font-medium`}
                  >
                    {session.type.charAt(0).toUpperCase() +
                      session.type.slice(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {session.sessionType.description && (
            <div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-3">
                Description
              </h3>
              <div className="bg-zinc-50 dark:bg-zinc-700/30 rounded-lg p-4">
                <div className="prose text-zinc-700 dark:text-zinc-300 dark:prose-invert max-w-none">
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                    {session.sessionType.description}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-3">
              Role Claims
            </h3>
            <div className="space-y-3">
              <div className="bg-zinc-50 dark:bg-zinc-700/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">
                  Host (1 slot)
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 w-16">
                    Host:
                  </span>
                  <HostButton
                    currentValue={session.owner?.username || ""}
                    onValueChange={handleHostClaim}
                    isSubmitting={isSubmitting}
                    canEdit={canManage}
                    availableUsers={availableUsers}
                    currentUserId={login.userId}
                    currentUserPicture={login.thumbnail}
                    currentUserUsername={login.username}
                  />
                </div>
              </div>

              {session.sessionType.slots &&
                Array.isArray(session.sessionType.slots) &&
                session.sessionType.slots.length > 0 &&
                session.sessionType.slots.map(
                  (slot: any, slotIndex: number) => {
                    if (typeof slot !== "object") return null;
                    const slotData = JSON.parse(JSON.stringify(slot));

                    return (
                      <div
                        key={slotIndex}
                        className="bg-zinc-50 dark:bg-zinc-700/30 rounded-lg p-4"
                      >
                        <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">
                          {slotData.name} ({slotData.slots} slot
                          {slotData.slots !== 1 ? "s" : ""})
                        </h4>
                        <div className="space-y-2">
                          {Array.from(Array(slotData.slots)).map((_, i) => {
                            const key = `${slotData.id}-${i}`;
                            const assignedUser = session.users?.find(
                              (u: any) =>
                                u.roleID === slotData.id && u.slot === i
                            );
                            const username = assignedUser
                              ? availableUsers.find(
                                  (user: any) =>
                                    user.userid ===
                                    assignedUser.userid.toString()
                                )?.username
                              : null;

                            return (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-sm text-zinc-600 dark:text-zinc-400 w-16">
                                  Slot {i + 1}:
                                </span>
                                <RoleButton
                                  currentValue={username || ""}
                                  onValueChange={(value) =>
                                    handleSlotClaim(slotData.id, i, value)
                                  }
                                  isSubmitting={isSubmitting}
                                  canEdit={canManage}
                                  availableUsers={availableUsers}
                                  currentUserId={login.userId}
                                  currentUserPicture={login.thumbnail}
                                  currentUserUsername={login.username}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                )}
            </div>
          </div>

          <NotesSection
            sessionId={session.id}
            canManage={canManage}
            currentUser={login}
            refreshKey={refreshKey}
            onDataChange={refreshSessionData}
          />

          <ActivityLogsSection 
            sessionId={session.id} 
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
};

const AutocompleteInput: React.FC<{
  currentValue: string;
  onValueChange: (value: string) => void;
  isSubmitting: boolean;
  canEdit: boolean;
  availableUsers: any[];
  currentUserId: number;
  currentUserPicture?: string;
  currentUserUsername?: string;
  placeholder?: string;
}> = ({
  currentValue,
  onValueChange,
  isSubmitting,
  canEdit,
  availableUsers,
  currentUserId,
  currentUserPicture,
  currentUserUsername,
  placeholder = "Enter username",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentValue);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setInputValue(currentValue);
  }, [currentValue]);

  useEffect(() => {
    if (inputValue.trim() === "") {
      const suggestions = [
        ...(currentUserUsername
          ? [
              {
                userid: currentUserId,
                username: currentUserUsername,
                picture: currentUserPicture || "/default-avatar.png",
                isSelf: true,
              },
            ]
          : []),
        ...availableUsers
          .filter((user) => user.userid !== currentUserId)
          .slice(0, 8),
      ];
      setFilteredUsers(suggestions);
    } else {
      const filtered = availableUsers
        .filter((user) =>
          user.username.toLowerCase().includes(inputValue.toLowerCase())
        )
        .slice(0, 8);
      setFilteredUsers(filtered);
    }
  }, [
    inputValue,
    availableUsers,
    currentUserId,
    currentUserUsername,
    currentUserPicture,
  ]);

  const handleSubmit = () => {
    onValueChange(inputValue);
    setIsEditing(false);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleCancel = () => {
    setInputValue(currentValue);
    setIsEditing(false);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleUserSelect = (user: any) => {
    if (user.isSelf) {
      setInputValue(user.username);
      onValueChange(user.username);
    } else {
      setInputValue(user.username);
      onValueChange(user.username);
    }
    setIsEditing(false);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && filteredUsers[selectedIndex]) {
        handleUserSelect(filteredUsers[selectedIndex]);
      } else {
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const handleInputBlur = (e: React.FocusEvent) => {
    setTimeout(() => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }, 150);
  };

  if (!canEdit) {
    return (
      <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
        <span className="text-zinc-700 dark:text-white">
          {currentValue || "No assignment"}
        </span>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={placeholder}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
              disabled={isSubmitting}
              autoFocus
            />

            {showSuggestions && filteredUsers.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredUsers.map((user, index) => (
                  <div
                    key={user.userid}
                    ref={(el) => {
                      suggestionRefs.current[index] = el;
                    }}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 ${
                      selectedIndex === index
                        ? "bg-zinc-50 dark:bg-zinc-700"
                        : ""
                    }`}
                    onClick={() => handleUserSelect(user)}
                  >
                    <img
                      src={user.picture || "/default-avatar.png"}
                      alt={user.username}
                      className="w-8 h-8 rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = "/default-avatar.png";
                      }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {user.username}
                        {user.isSelf && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                    {user.isSelf && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Claim
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-3 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-3 py-2 text-sm bg-zinc-500 text-white rounded-md hover:bg-zinc-600 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      disabled={isSubmitting}
      className="w-full px-4 py-2 text-left bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
    >
      <span className="text-zinc-700 dark:text-white">
        {currentValue || "Unclaimed"}
      </span>
    </button>
  );
};

const HostButton: React.FC<{
  currentValue: string;
  onValueChange: (value: string) => void;
  isSubmitting: boolean;
  canEdit: boolean;
  availableUsers: any[];
  currentUserId: number;
  currentUserPicture?: string;
  currentUserUsername?: string;
}> = ({
  currentValue,
  onValueChange,
  isSubmitting,
  canEdit,
  availableUsers,
  currentUserId,
  currentUserPicture,
  currentUserUsername,
}) => {
  return (
    <AutocompleteInput
      currentValue={currentValue}
      onValueChange={onValueChange}
      isSubmitting={isSubmitting}
      canEdit={canEdit}
      availableUsers={availableUsers}
      currentUserId={currentUserId}
      currentUserPicture={currentUserPicture}
      currentUserUsername={currentUserUsername}
      placeholder="Enter username to assign host"
    />
  );
};

const RoleButton: React.FC<{
  currentValue: string;
  onValueChange: (value: string) => void;
  isSubmitting: boolean;
  canEdit: boolean;
  availableUsers: any[];
  currentUserId: number;
  currentUserPicture?: string;
  currentUserUsername?: string;
}> = ({
  currentValue,
  onValueChange,
  isSubmitting,
  canEdit,
  availableUsers,
  currentUserId,
  currentUserPicture,
  currentUserUsername,
}) => {
  return (
    <AutocompleteInput
      currentValue={currentValue}
      onValueChange={onValueChange}
      isSubmitting={isSubmitting}
      canEdit={canEdit}
      availableUsers={availableUsers}
      currentUserId={currentUserId}
      currentUserPicture={currentUserPicture}
      currentUserUsername={currentUserUsername}
      placeholder="Enter username to assign role"
    />
  );
};

const NotesSection: React.FC<{
  sessionId: string;
  canManage: boolean;
  currentUser: any;
  refreshKey?: number;
  onDataChange?: () => void;
}> = ({ sessionId, canManage, currentUser, refreshKey, onDataChange }) => {
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `/api/workspace/${router.query.id}/sessions/${sessionId}/notes`
      );
      setNotes(response.data.notes || []);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      setIsSubmitting(true);
      await axios.post(
        `/api/workspace/${router.query.id}/sessions/${sessionId}/notes`,
        {
          content: newNote.trim(),
        }
      );
      setNewNote("");
      fetchNotes();
      onDataChange?.(); // Trigger parent refresh
      toast.success("Note added successfully");
    } catch (error: any) {
      console.error("Failed to add note:", error);
      toast.error(error?.response?.data?.error || "Failed to add note");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchNotes();
    }
  }, [sessionId, refreshKey]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <IconNotes className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
          Notes
        </h3>
      </div>

      {canManage && (
        <div className="mb-4">
          <div className="flex flex-col gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this session..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary dark:bg-zinc-700 dark:text-white"
              rows={2}
              disabled={isSubmitting}
            />
            <div className="flex justify-between items-center">
              <button
                onClick={addNote}
                disabled={isSubmitting || !newNote.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <IconSend className="w-4 h-4" />
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
            <IconNotes className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-zinc-500 dark:text-zinc-400">No notes yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              {canManage
                ? "Add the first note above"
                : "Notes will appear here when added"}
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-zinc-50 dark:bg-zinc-700/30 rounded-lg p-3"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <img
                    src={note.author?.picture || "/default-avatar.png"}
                    alt={note.author?.username || "User"}
                    className="w-6 h-6 rounded-full"
                    onError={(e) => {
                      e.currentTarget.src = "/default-avatar.png";
                    }}
                  />
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {note.author?.username || "Unknown User"}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(note.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="prose text-zinc-700 dark:text-zinc-300 dark:prose-invert max-w-none text-sm">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                  {note.content}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ActivityLogsSection: React.FC<{
  sessionId: string;
  refreshKey?: number;
}> = ({ sessionId, refreshKey }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `/api/workspace/${router.query.id}/sessions/${sessionId}/logs`
      );
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchLogs();
    }
  }, [sessionId, refreshKey]);

  const getLogIcon = (action: string) => {
    switch (action) {
      case "role_assigned":
      case "host_assigned":
        return <IconUserPlus className="w-4 h-4 text-green-500" />;
      case "role_unassigned":
      case "host_unassigned":
        return <IconUserMinus className="w-4 h-4 text-red-500" />;
      case "session_claimed":
        return <IconUserCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <IconHistory className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getLogMessage = (log: any) => {
    const actorName = log.actor?.username || "Unknown User";
    const targetName = log.target?.username || "Unknown User";

    switch (log.action) {
      case "role_assigned":
        return `${actorName} assigned ${targetName} to role "${
          log.metadata?.roleName || "Unknown Role"
        }"`;
      case "role_unassigned":
        return `${actorName} removed ${targetName} from role "${
          log.metadata?.roleName || "Unknown Role"
        }"`;
      case "host_assigned":
        return `${actorName} assigned ${targetName} as host`;
      case "host_unassigned":
        return `${actorName} removed ${targetName} as host`;
      case "session_claimed":
        return `${actorName} claimed this session`;
      default:
        return `${actorName} performed an action`;
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <IconHistory className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
          Activity Log
        </h3>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">
            Loading activity log...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
            <IconHistory className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-zinc-500 dark:text-zinc-400">No activity yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              Actions will be logged here automatically
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg"
            >
              {getLogIcon(log.action)}
              <div className="flex-1">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {getLogMessage(log)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SessionModal;
