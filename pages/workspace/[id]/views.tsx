import workspace from "@/layouts/workspace";
import { pageWithLayout } from "@/layoutTypes";
import { loginState } from "@/state";
import { Fragment, useEffect, useState } from "react";
import { Dialog, Popover, Transition } from "@headlessui/react";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { getThumbnail } from "@/utils/userinfoEngine";
import { useRecoilState } from "recoil";
import noblox from "noblox.js";
import Input from "@/components/input";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/utils/database";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { FormProvider, useForm } from "react-hook-form";
import Button from "@/components/button";
import {
  inactivityNotice,
  Session,
  user,
  userBook,
  wallPost,
} from "@prisma/client";
import Checkbox from "@/components/checkbox";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";
import { useRouter } from "next/router";
import moment from "moment";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import {
  IconArrowLeft,
  IconFilter,
  IconPlus,
  IconSearch,
  IconUsers,
  IconX,
  IconUserCheck,
  IconAlertCircle,
  IconShieldX,
} from "@tabler/icons-react";

type User = {
  info: {
    userId: BigInt;
    username: string | null;
    picture: string | null;
  };
  book: userBook[];
  wallPosts: wallPost[];
  inactivityNotices: inactivityNotice[];
  sessions: any[];
  rankID: number;
  minutes: number;
  idleMinutes: number;
  hostedSessions: { length: number };
  sessionsAttended: number;
  messages: number;
  registered: boolean;
  quota: boolean;
};

export const getServerSideProps = withPermissionCheckSsr(
  async ({ params }: GetServerSidePropsContext) => {
    const workspaceGroupId = parseInt(params?.id as string);
    const lastReset = await prisma.activityReset.findFirst({
      where: {
        workspaceGroupId,
      },
      orderBy: {
        resetAt: "desc",
      },
    });

    const startDate = lastReset?.resetAt || new Date("2025-01-01");
    const currentDate = new Date();

    const allUsers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            workspaceGroupId,
          },
        },
      },
      include: {
        book: true,
        wallPosts: true,
        inactivityNotices: true,
        sessions: true,
        ranks: true,
        roles: {
          where: {
            workspaceGroupId,
          },
          include: {
            quotaRoles: {
              include: {
                quota: true,
              },
            },
          },
        },
      },
    });

    const allActivity = await prisma.activitySession.findMany({
      where: {
        workspaceGroupId,
        startTime: {
          gte: startDate,
          lte: currentDate,
        },
      },
      include: {
        user: {
          include: {
            writtenBooks: true,
            wallPosts: true,
            inactivityNotices: true,
            sessions: true,
            ranks: true,
          },
        },
      },
    });

    const computedUsers: any[] = [];
    const ranks = await noblox.getRoles(workspaceGroupId);

    for (const user of allUsers) {
      const ms: number[] = [];
      allActivity
        .filter((x) => BigInt(x.userId) == user.userid && !x.active)
        .forEach((session) => {
          ms.push(
            (session.endTime?.getTime() as number) -
              session.startTime.getTime() -
              (session.idleTime ? Number(session.idleTime) * 60000 : 0) // Convert idle minutes to milliseconds
          );
        });

      const ims: number[] = [];
      allActivity
        .filter((x: any) => BigInt(x.userId) == user.userid)
        .forEach((s: any) => {
          ims.push(Number(s.idleTime));
        });

      const messages: number[] = [];
      allActivity
        .filter((x: any) => BigInt(x.userId) == user.userid)
        .forEach((s: any) => {
          messages.push(s.messages);
        });

      const userAdjustments = await prisma.activityAdjustment.findMany({
        where: {
          userId: user.userid,
          workspaceGroupId,
          createdAt: {
            gte: startDate,
            lte: currentDate,
          },
        },
      });

      const userId = user.userid;
      const ownedSessions = await prisma.session.findMany({
        where: {
          ownerId: userId,
          sessionType: { workspaceGroupId },
          date: {
            gte: startDate,
            lte: currentDate,
          },
        },
      });

      const allSessionParticipations = await prisma.sessionUser.findMany({
        where: {
          userid: userId,
          session: {
            sessionType: { workspaceGroupId },
            date: {
              gte: startDate,
              lte: currentDate,
            },
          },
        },
        include: {
          session: {
            select: {
              id: true,
              sessionType: {
                select: {
                  slots: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const roleBasedHostedSessions = allSessionParticipations.filter(
        (participation) => {
          const slots = participation.session.sessionType.slots as any[];
          const slotIndex = participation.slot;
          const slotName = slots[slotIndex]?.name || "";
          return (
            participation.roleID.toLowerCase().includes("co-host") ||
            slotName.toLowerCase().includes("co-host")
          );
        }
      ).length;

      const sessionsHosted = ownedSessions.length + roleBasedHostedSessions;
      const ownedSessionIds = new Set(ownedSessions.map((s) => s.id));
      const sessionsAttended = allSessionParticipations.filter(
        (participation) => {
          const slots = participation.session.sessionType.slots as any[];
          const slotIndex = participation.slot;
          const slotName = slots[slotIndex]?.name || "";
          const isCoHost =
            participation.roleID.toLowerCase().includes("co-host") ||
            slotName.toLowerCase().includes("co-host");

          return !isCoHost && !ownedSessionIds.has(participation.sessionid);
        }
      ).length;

      const currentWallPosts = await prisma.wallPost.findMany({
        where: {
          authorId: userId,
          workspaceGroupId,
          createdAt: {
            gte: startDate,
            lte: currentDate,
          },
        },
      });

      const userQuotas = user.roles
        .flatMap((role) => role.quotaRoles)
        .map((qr) => qr.quota);

      let quota = true;
      if (userQuotas.length > 0) {
        for (const userQuota of userQuotas) {
          let currentValue = 0;

          switch (userQuota.type) {
            case "mins":
              const totalAdjustmentMinutes = userAdjustments.reduce(
                (sum, adj) => sum + adj.minutes,
                0
              );
              const totalActiveMinutes = ms.length
                ? Math.round(ms.reduce((p, c) => p + c) / 60000)
                : 0;
              currentValue = totalActiveMinutes + totalAdjustmentMinutes;
              break;
            case "sessions_hosted":
              currentValue = sessionsHosted;
              break;
            case "sessions_attended":
              currentValue = sessionsAttended;
              break;
          }

          if (currentValue < userQuota.value) {
            quota = false;
            break;
          }
        }
      } else {
        quota = false;
      }

      const totalAdjustmentMs = userAdjustments.reduce(
        (sum, adj) => sum + adj.minutes * 60000,
        0
      );

      const totalActiveMs =
        (ms.length ? ms.reduce((p, c) => p + c) : 0) + totalAdjustmentMs;

      computedUsers.push({
        info: {
          userId: Number(user.userid),
          picture: await getThumbnail(user.userid),
          username: user.username,
        },
        book: user.book,
        wallPosts: currentWallPosts,
        inactivityNotices: user.inactivityNotices,
        sessions: allSessionParticipations,
        rankID: user.ranks[0]?.rankId ? Number(user.ranks[0]?.rankId) : 0,
        minutes: Math.round(totalActiveMs / 60000),
        idleMinutes: ims.length ? Math.round(ims.reduce((p, c) => p + c)) : 0,
        hostedSessions: { length: sessionsHosted },
        sessionsAttended: sessionsAttended,
        messages: messages.length
          ? Math.round(messages.reduce((p, c) => p + c))
          : 0,
        registered: user.registered || false,
        quota: quota,
      });
    }

    const usersNotInComputedUsers = allActivity.filter(
      (x: any) =>
        !computedUsers.find(
          (y: any) => BigInt(y.info.userId) == BigInt(x.userId)
        )
    );
    for (const x of usersNotInComputedUsers) {
      if (
        computedUsers.find(
          (y: any) => BigInt(y.info.userId) == BigInt(x.userId)
        )
      )
        continue;

      const ms: number[] = [];
      allActivity
        .filter((y: any) => BigInt(y.userId) == BigInt(x.userId) && !y.active)
        .forEach((session) => {
          ms.push(
            (session.endTime?.getTime() as number) -
              session.startTime.getTime() -
              (session.idleTime ? Number(session.idleTime) * 60000 : 0) // Convert idle minutes to milliseconds
          );
        });

      const ims: number[] = [];
      allActivity
        .filter((y: any) => BigInt(y.userId) == BigInt(x.userId))
        .forEach((s: any) => {
          ims.push(Number(s.idleTime));
        });

      const messages: number[] = [];
      allActivity
        .filter((y: any) => BigInt(y.userId) == BigInt(x.userId))
        .forEach((s: any) => {
          messages.push(s.messages);
        });

      const userId = BigInt(x.userId);
      const ownedSessions = await prisma.session.findMany({
        where: {
          ownerId: userId,
          sessionType: { workspaceGroupId },
          date: {
            gte: startDate,
            lte: currentDate,
          },
        },
      });

      const allSessionParticipations = await prisma.sessionUser.findMany({
        where: {
          userid: userId,
          session: {
            sessionType: { workspaceGroupId },
            date: {
              gte: startDate,
              lte: currentDate,
            },
          },
        },
        include: {
          session: {
            select: {
              id: true,
              sessionType: {
                select: {
                  slots: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const roleBasedHostedSessions = allSessionParticipations.filter(
        (participation) => {
          const slots = participation.session.sessionType.slots as any[];
          const slotIndex = participation.slot;
          const slotName = slots[slotIndex]?.name || "";

          return (
            participation.roleID.toLowerCase().includes("co-host") ||
            slotName.toLowerCase().includes("co-host")
          );
        }
      ).length;

      const sessionsHosted = ownedSessions.length + roleBasedHostedSessions;

      const ownedSessionIds = new Set(ownedSessions.map((s) => s.id));
      const sessionsAttended = allSessionParticipations.filter(
        (participation) => {
          const slots = participation.session.sessionType.slots as any[];
          const slotIndex = participation.slot;
          const slotName = slots[slotIndex]?.name || "";

          const isCoHost =
            participation.roleID.toLowerCase().includes("co-host") ||
            slotName.toLowerCase().includes("co-host");

          return !isCoHost && !ownedSessionIds.has(participation.sessionid);
        }
      ).length;
      const currentWallPosts = await prisma.wallPost.findMany({
        where: {
          authorId: userId,
          workspaceGroupId,
          createdAt: {
            gte: startDate,
            lte: currentDate,
          },
        },
      });

      const userAdjustments = await prisma.activityAdjustment.findMany({
        where: {
          userId: BigInt(x.userId),
          workspaceGroupId,
          createdAt: {
            gte: startDate,
            lte: currentDate,
          },
        },
      });

      const totalAdjustmentMs = userAdjustments.reduce(
        (sum, adj) => sum + adj.minutes * 60000,
        0
      );
      const totalActiveMs =
        (ms.length ? ms.reduce((p, c) => p + c) : 0) + totalAdjustmentMs;

      const quota = false;
      computedUsers.push({
        info: {
          userId: Number(x.userId),
          picture: x.user.picture || null,
          username: x.user.username,
        },
        book: [],
        wallPosts: currentWallPosts, // Use current period wall posts
        inactivityNotices: [],
        sessions: allSessionParticipations,
        rankID: x.user.ranks[0]?.rankId ? Number(x.user.ranks[0]?.rankId) : 0,
        minutes: Math.round(totalActiveMs / 60000),
        idleMinutes: ims.length ? Math.round(ims.reduce((p, c) => p + c)) : 0, // Already in minutes from Roblox
        hostedSessions: { length: sessionsHosted },
        sessionsAttended: sessionsAttended,
        messages: messages.length
          ? Math.round(messages.reduce((p, c) => p + c))
          : 0,
        registered: x.user.registered || false,
        quota: quota,
      });
    }

    return {
      props: {
        usersInGroup: JSON.parse(
          JSON.stringify(computedUsers, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ) as User[],
        ranks: ranks,
      },
    };
  },
  "view_members"
);

const filters: {
  [key: string]: string[];
} = {
  username: ["equal", "notEqual", "contains"],
  minutes: ["equal", "greaterThan", "lessThan"],
  idle: ["equal", "greaterThan", "lessThan"],
  rank: ["equal", "greaterThan", "lessThan"],
  sessions: ["equal", "greaterThan", "lessThan"],
  hosted: ["equal", "greaterThan", "lessThan"],
  warnings: ["equal", "greaterThan", "lessThan"],
  messages: ["equal", "greaterThan", "lessThan"],
  notices: ["equal", "greaterThan", "lessThan"],
  registered: ["equal"],
  quota: ["equal"],
};

const filterNames: {
  [key: string]: string;
} = {
  equal: "Equals",
  notEqual: "Does not equal",
  contains: "Contains",
  greaterThan: "Greater than",
  lessThan: "Less than",
};

type pageProps = {
  usersInGroup: User[];
  ranks: {
    id: number;
    rank: number;
    name: string;
  }[];
};
const Views: pageWithLayout<pageProps> = ({ usersInGroup, ranks }) => {
  const [login, setLogin] = useRecoilState(loginState);
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [users, setUsers] = useState(usersInGroup);
  const [isLoading, setIsLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [colFilters, setColFilters] = useState<
    {
      id: string;
      column: string;
      filter: string;
      value: string;
    }[]
  >([]);

  const columnHelper = createColumnHelper<User>();

  const updateUsers = async (query: string) => {};

  const columns = [
    {
      id: "select",
      header: ({ table }: any) => (
        <Checkbox
          {...{
            checked: table.getIsAllRowsSelected(),
            indeterminate: table.getIsSomeRowsSelected(),
            onChange: table.getToggleAllRowsSelectedHandler(),
          }}
        />
      ),
      cell: ({ row }: any) => (
        <Checkbox
          {...{
            checked: row.getIsSelected(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler(),
          }}
        />
      ),
    },
    columnHelper.accessor("info", {
      header: "User",
      cell: (row) => {
        return (
          <div
            className="flex flex-row cursor-pointer"
            onClick={() =>
              router.push(
                `/workspace/${router.query.id}/profile/${row.getValue().userId}`
              )
            }
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${getRandomBg(
                row.getValue().userId.toString()
              )}`}
            >
              <img
                src={row.getValue().picture!}
                className="w-10 h-10 rounded-full object-cover border-2 border-white"
                style={{ background: "transparent" }}
              />
            </div>
            <p className="leading-5 my-auto px-2 font-semibold dark:text-white">
              {row.getValue().username} <br />
            </p>
          </div>
        );
      },
    }),
    columnHelper.accessor("rankID", {
      header: "Rank",
      cell: (row) => {
        return (
          <p className="dark:text-white">
            {ranks.find((x) => x.rank == row.getValue())?.name || "N/A"}
          </p>
        );
      },
    }),
    columnHelper.accessor("book", {
      header: "Warnings",
      cell: (row) => {
        return (
          <p className="dark:text-white">
            {row.getValue().filter((x) => x.type == "warning").length}
          </p>
        );
      },
    }),
    columnHelper.accessor("sessionsAttended", {
      header: "Sessions attended",
      cell: (row) => {
        return <p className="dark:text-white">{row.getValue()}</p>;
      },
    }),
    columnHelper.accessor("hostedSessions", {
      header: "Sessions hosted",
      cell: (row) => {
        return <p className="dark:text-white">{row.getValue().length}</p>;
      },
    }),
    columnHelper.accessor("wallPosts", {
      header: "Wall posts",
      cell: (row) => {
        return <p className="dark:text-white">{row.getValue().length}</p>;
      },
    }),
    columnHelper.accessor("inactivityNotices", {
      header: "Inactivity notices",
      cell: (row) => {
        return <p className="dark:text-white">{row.getValue().length}</p>;
      },
    }),
    columnHelper.accessor("minutes", {
      header: "Minutes",
      cell: (row) => {
        return <p className="dark:text-white">{row.getValue()}</p>;
      },
    }),
    columnHelper.accessor("idleMinutes", {
      header: "Idle minutes",
      cell: (row) => {
        return <p className="dark:text-white">{row.getValue()}</p>;
      },
    }),
    columnHelper.accessor("messages", {
      header: "Messages",
      cell: (row) => {
        return <p className="dark:text-white">{row.getValue()}</p>;
      },
    }),
    columnHelper.accessor("registered", {
      header: "Registered",
      cell: (row) => {
        return <p>{row.getValue() ? "✅" : "❌"}</p>;
      },
    }),
    columnHelper.accessor("quota", {
      header: "Quota Complete",
      cell: (row) => {
        return <p>{row.getValue() ? "✅" : "❌"}</p>;
      },
    }),
  ];

  const [columnVisibility, setColumnVisibility] = useState({
    inactivityNotices: false,
    idleMinutes: false,
    registered: false,
    quota: false,
  });

  const table = useReactTable({
    columns,
    data: users,
    state: {
      sorting,
      rowSelection,
      // @ts-ignore
      columnVisibility,
    },
    // @ts-ignore
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const newfilter = () => {
    setColFilters([
      ...colFilters,
      { id: uuidv4(), column: "username", filter: "equal", value: "" },
    ]);
  };
  const removeFilter = (id: string) => {
    setColFilters(colFilters.filter((filter) => filter.id !== id));
  };
  const updateFilter = (
    id: string,
    column: string,
    filter: string,
    value: string
  ) => {
    const OBJ = Object.assign([] as typeof colFilters, colFilters);
    const index = OBJ.findIndex((filter) => filter.id === id);
    OBJ[index] = { id, column, filter, value };
    setColFilters(OBJ);
  };

  useEffect(() => {
    const filteredUsers = usersInGroup.filter((user) => {
      let valid = true;
      colFilters.forEach((filter) => {
        if (filter.column === "username") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.info.username !== filter.value) {
              valid = false;
            }
          } else if (filter.filter === "notEqual") {
            if (user.info.username === filter.value) {
              valid = false;
            }
          } else if (filter.filter === "contains") {
            if (!user.info.username?.includes(filter.value)) {
              valid = false;
            }
          }
        } else if (filter.column === "minutes") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.minutes !== parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "greaterThan") {
            if (user.minutes <= parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "lessThan") {
            if (user.minutes >= parseInt(filter.value)) {
              valid = false;
            }
          }
        } else if (filter.column === "idle") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.idleMinutes !== parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "greaterThan") {
            if (user.idleMinutes <= parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "lessThan") {
            if (user.idleMinutes >= parseInt(filter.value)) {
              valid = false;
            }
          }
        } else if (filter.column === "rank") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.rankID !== parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "greaterThan") {
            if (user.rankID <= parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "lessThan") {
            if (user.rankID >= parseInt(filter.value)) {
              valid = false;
            }
          }
        } else if (filter.column === "hosted") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.hostedSessions.length !== parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "greaterThan") {
            if (user.hostedSessions.length <= parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "lessThan") {
            if (user.hostedSessions.length >= parseInt(filter.value)) {
              valid = false;
            }
          }
        } else if (filter.column === "sessions") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.sessions.length !== parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "greaterThan") {
            if (user.sessions.length <= parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "lessThan") {
            if (user.sessions.length >= parseInt(filter.value)) {
              valid = false;
            }
          }
        } else if (filter.column === "warnings") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (
              user.book.filter((x) => x.type == "warning").length !==
              parseInt(filter.value)
            ) {
              valid = false;
            }
          } else if (filter.filter === "greaterThan") {
            if (
              user.book.filter((x) => x.type == "warning").length <=
              parseInt(filter.value)
            ) {
              valid = false;
            }
          } else if (filter.filter === "lessThan") {
            if (
              user.book.filter((x) => x.type == "warning").length >=
              parseInt(filter.value)
            ) {
              valid = false;
            }
          }
        } else if (filter.column === "messages") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.messages !== parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "greaterThan") {
            if (user.messages <= parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "lessThan") {
            if (user.messages >= parseInt(filter.value)) {
              valid = false;
            }
          }
        } else if (filter.column === "notices") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.inactivityNotices.length !== parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "greaterThan") {
            if (user.inactivityNotices.length <= parseInt(filter.value)) {
              valid = false;
            }
          } else if (filter.filter === "lessThan") {
            if (user.inactivityNotices.length >= parseInt(filter.value)) {
              valid = false;
            }
          }
        } else if (filter.column === "registered") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.registered.toString() !== filter.value.toLowerCase()) {
              valid = false;
            }
          }
        } else if (filter.column === "quota") {
          if (!filter.value) return;
          if (filter.filter === "equal") {
            if (user.quota.toString() !== filter.value.toLowerCase()) {
              valid = false;
            }
          }
        }
      });
      return valid;
    });
    setUsers(filteredUsers);
  }, [colFilters]);

  const massAction = () => {
    const selected = table.getSelectedRowModel().flatRows;
    const promises: any[] = [];
    for (const select of selected) {
      const data = select.original;

      if (type == "add") {
        promises.push(
          axios.post(`/api/workspace/${router.query.id}/activity/add`, {
            userId: data.info.userId,
            minutes,
          })
        );
      } else {
        promises.push(
          axios.post(
            `/api/workspace/${router.query.id}/userbook/${data.info.userId}/new`,
            { notes: message, type }
          )
        );
      }
    }

    toast.promise(Promise.all(promises), {
      loading: "Actions in progress...",
      success: () => {
        setIsOpen(false);
        return "Actions applied!";
      },
      error: "Could not perform actions.",
    });

    setIsOpen(false);
    setMessage("");
    setType("");
  };

  const updateSearchQuery = async (query: any) => {
    setSearchQuery(query);
    setSearchOpen(true);
    if (query == "") {
      setSearchOpen(false);
      setColFilters([]);
      return;
    } else {
      setSearchOpen(true);
    }
    const userRequest = await axios.get(
      `/api/workspace/${router.query.id}/staff/search/${query}`
    );
    const userList = userRequest.data.users;
    setSearchResults(userList);
  };

  const updateSearchFilter = async (username: string) => {
    setSearchQuery(username);
    setSearchOpen(false);
    setColFilters([
      { id: uuidv4(), column: "username", filter: "equal", value: username },
    ]);
  };

  const getSelectionName = (columnId: string) => {
    if (columnId == "sessionsAttended") {
      return "Sessions Attended";
    } else if (columnId == "hostedSessions") {
      return "Hosted Sessions";
    } else if (columnId == "book") {
      return "Warnings";
    } else if (columnId == "wallPosts") {
      return "Wall Posts";
    } else if (columnId == "rankID") {
      return "Rank";
    } else if (columnId == "inactivityNotices") {
      return "Inactivity notices";
    } else if (columnId == "minutes") {
      return "Minutes";
    } else if (columnId == "idleMinutes") {
      return "Idle minutes";
    } else if (columnId == "messages") {
      return "Messages";
    } else if (columnId == "registered") {
      return "Registered";
    } else if (columnId == "quota") {
      return "Quota Complete";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900">
      <Toaster position="bottom-center" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-br from-[#ff0099]/20 to-[#ff0099]/10 p-3 rounded-lg flex-shrink-0">
              <IconUsers className="w-6 h-6 text-[#ff0099]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                Staff Management
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                View and manage your staff members
              </p>
            </div>
          </div>
        </div>

        {/* Controls Card */}
        <div className="bg-white dark:bg-zinc-800/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700/50 rounded-lg p-4 mb-6 relative z-10 overflow-visible">
          {/* Filter and Column Controls */}
          <div className="flex flex-col md:flex-row gap-3 relative z-20">
            <div className="flex gap-2">
              {/* Filters Popover */}
              <Popover className="relative z-20">
                {({ open }) => (
                  <>
                    <Popover.Button
                      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        open
                          ? "bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white ring-2 ring-[#ff0099]/50"
                          : "bg-zinc-50 dark:bg-zinc-700/50 border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      <IconFilter className="w-4 h-4" />
                      <span>Filters</span>
                    </Popover.Button>

                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="opacity-0 translate-y-1"
                      enterTo="opacity-100 translate-y-0"
                      leave="transition ease-in duration-150"
                      leaveFrom="opacity-100 translate-y-0"
                      leaveTo="opacity-0 translate-y-1"
                    >
                      <Popover.Panel className="absolute left-0 z-50 mt-2 w-72 origin-top-left rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xl p-4 top-full">
                        <div className="space-y-3">
                          <button
                            onClick={newfilter}
                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white bg-[#ff0099] hover:bg-[#ff0099]/90 transition-all"
                          >
                            <IconPlus className="w-4 h-4" />
                            Add Filter
                          </button>

                          {colFilters.map((filter) => (
                            <div
                              key={filter.id}
                              className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900/50"
                            >
                              <Filter
                                ranks={ranks}
                                updateFilter={(col, op, value) =>
                                  updateFilter(filter.id, col, op, value)
                                }
                                deleteFilter={() => removeFilter(filter.id)}
                                data={filter}
                              />
                            </div>
                          ))}
                          {colFilters.length === 0 && (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">
                              No filters added yet
                            </p>
                          )}
                        </div>
                      </Popover.Panel>
                    </Transition>
                  </>
                )}
              </Popover>

              {/* Columns Popover */}
              <Popover className="relative z-20">
                {({ open }) => (
                  <>
                    <Popover.Button
                      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        open
                          ? "bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white ring-2 ring-[#ff0099]/50"
                          : "bg-zinc-50 dark:bg-zinc-700/50 border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      <IconUsers className="w-4 h-4" />
                      <span>Columns</span>
                    </Popover.Button>

                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="opacity-0 translate-y-1"
                      enterTo="opacity-100 translate-y-0"
                      leave="transition ease-in duration-150"
                      leaveFrom="opacity-100 translate-y-0"
                      leaveTo="opacity-0 translate-y-1"
                    >
                      <Popover.Panel className="absolute left-0 z-50 mt-2 w-56 origin-top-left rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xl p-4 top-full">
                        <div className="space-y-2">
                          {table.getAllLeafColumns().map((column: any) => {
                            if (
                              column.id !== "select" &&
                              column.id !== "info"
                            ) {
                              return (
                                <label
                                  key={column.id}
                                  className="flex items-center space-x-2 cursor-pointer group"
                                >
                                  <Checkbox
                                    checked={column.getIsVisible()}
                                    onChange={column.getToggleVisibilityHandler()}
                                  />
                                  <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                                    {getSelectionName(column.id)}
                                  </span>
                                </label>
                              );
                            }
                          })}
                        </div>
                      </Popover.Panel>
                    </Transition>
                  </>
                )}
              </Popover>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 md:flex-none md:w-56">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IconSearch className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => updateSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-[6px;] border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-200 placeholder-zinc-500 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#ff0099]/50 focus:border-transparent transition-all"
                  placeholder="Search staff..."
                />
              </div>

              {searchOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl">
                  <div className="py-1 max-h-48 overflow-y-auto">
                    {searchResults.length === 0 && (
                      <div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
                        No results found
                      </div>
                    )}
                    {searchResults.map((u: any) => (
                      <button
                        key={u.username}
                        onClick={() => updateSearchFilter(u.username)}
                        className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center space-x-2 transition-colors group"
                      >
                        <img
                          src={u.thumbnail}
                          alt={u.username}
                          className="w-6 h-6 rounded-full bg-[#ff0099]"
                        />
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                          {u.username}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mass Actions */}
          {table.getSelectedRowModel().flatRows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 py-2">
                {table.getSelectedRowModel().flatRows.length} selected
              </span>
              <button
                onClick={() => {
                  setType("promotion");
                  setIsOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white bg-emerald-600/80 hover:bg-emerald-600 transition-all"
              >
                <IconUserCheck className="w-4 h-4" />
                Promote
              </button>
              <button
                onClick={() => {
                  setType("warning");
                  setIsOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white bg-amber-600/80 hover:bg-amber-600 transition-all"
              >
                <IconAlertCircle className="w-4 h-4" />
                Warn
              </button>
              <button
                onClick={() => {
                  setType("fire");
                  setIsOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white bg-red-600/80 hover:bg-red-600 transition-all"
              >
                <IconShieldX className="w-4 h-4" />
                Terminate
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-800/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700/50 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-300 uppercase tracking-widest cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder ? null : (
                          <div className="flex items-center space-x-1 text-zinc-900 dark:text-zinc-300">
                            <span>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                          </div>
                        )}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900/20 divide-y divide-zinc-200 dark:divide-zinc-700">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-100 dark:hover:bg-zinc-700/30 transition-colors border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3 whitespace-nowrap text-sm text-zinc-700 dark:text-zinc-300"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white dark:bg-zinc-800/50 px-4 py-3 flex items-center justify-center border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-400 dark:disabled:text-zinc-500 transition-all"
              >
                Previous
              </button>
              <span className="inline-flex items-center px-4 py-2 bg-zinc-100 dark:bg-zinc-700/50 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-400 dark:disabled:text-zinc-500 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mass Action Dialog */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsOpen(false)}
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
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 p-5 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="div"
                    className="flex items-center justify-between mb-3"
                  >
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                      Mass {type} {type === "add" ? "minutes" : ""}
                    </h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="text-zinc-400 hover:text-zinc-500"
                    >
                      <IconX className="w-5 h-5" />
                    </button>
                  </Dialog.Title>

                  <FormProvider
                    {...useForm({
                      defaultValues: {
                        value: type === "add" ? minutes.toString() : message,
                      },
                    })}
                  >
                    <div className="mt-3">
                      <Input
                        type={type === "add" ? "number" : "text"}
                        placeholder={type === "add" ? "Minutes" : "Message"}
                        value={type === "add" ? minutes.toString() : message}
                        name="value"
                        id="value"
                        onBlur={async () => true}
                        onChange={async (e) => {
                          if (type === "add") {
                            setMinutes(parseInt(e.target.value) || 0);
                          } else {
                            setMessage(e.target.value);
                          }
                          return true;
                        }}
                      />
                    </div>
                  </FormProvider>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      className="inline-flex justify-center px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white dark:bg-zinc-800 border border-gray-300 rounded-md hover:bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center px-3 py-1.5 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                      onClick={massAction}
                    >
                      Confirm
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

const BG_COLORS = [
  "bg-rose-200",
  "bg-lime-200",
  "bg-sky-200",
  "bg-amber-200",
  "bg-violet-200",
  "bg-fuchsia-200",
  "bg-emerald-200",
  "bg-indigo-200",
  "bg-pink-200",
  "bg-cyan-200",
  "bg-red-200",
  "bg-green-200",
  "bg-blue-200",
  "bg-yellow-200",
  "bg-teal-200",
  "bg-orange-200",
];

function getRandomBg(userid: string, username?: string) {
  const key = `${userid ?? ""}:${username ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  const index = (hash >>> 0) % BG_COLORS.length;
  return BG_COLORS[index];
}


const Filter: React.FC<{
  data: {
    column: string;
    filter: string;
    value: string;
  };
  updateFilter: (column: string, op: string, value: string) => void;
  deleteFilter: () => void;
  ranks: {
    id: number;
    name: string;
    rank: number;
  }[];
}> = ({ updateFilter, deleteFilter, data, ranks }) => {
  const methods = useForm<{
    col: string;
    op: string;
    value: string;
  }>({
    defaultValues: {
      col: data.column,
      op: data.filter,
      value: data.value,
    },
  });

  const { register, handleSubmit, getValues } = methods;

  useEffect(() => {
    const subscription = methods.watch(() => {
      updateFilter(
        methods.getValues().col,
        methods.getValues().op,
        methods.getValues().value
      );
    });
    return () => subscription.unsubscribe();
  }, [methods.watch]);

  return (
    <FormProvider {...methods}>
      <div className="space-y-4">
        <button
          onClick={deleteFilter}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-zinc-700 dark:text-white bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Delete Filter
        </button>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-white">
            Column
          </label>
          <select
            {...register("col")}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
          >
            {Object.keys(filters).map((filter) => (
              <option value={filter} key={filter}>
                {filter}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-white">
            Operation
          </label>
          <select
            {...register("op")}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
          >
            {filters[methods.getValues().col].map((filter) => (
              <option value={filter} key={filter}>
                {filterNames[filter]}
              </option>
            ))}
          </select>
        </div>

        {getValues("col") !== "rank" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-white">
              Value
            </label>
            <Input {...register("value")} />
          </div>
        )}

        {getValues("col") === "rank" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-white">
              Value
            </label>
            <select
              {...register("value")}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
            >
              {ranks.map((rank) => (
                <option value={rank.rank} key={rank.id}>
                  {rank.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {getValues("col") === "registered" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-white">
              Value
            </label>
            <select
              {...register("value")}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
            >
              <option value="true">✅</option>
              <option value="false">❌</option>
            </select>
          </div>
        )}

        {getValues("col") === "quota" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-white">
              Value
            </label>
            <select
              {...register("value")}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
            >
              <option value="true">✅</option>
              <option value="false">❌</option>
            </select>
          </div>
        )}
      </div>
    </FormProvider>
  );
};

Views.layout = workspace;
export default Views;
