import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { getConfig } from "@/utils/configEngine";

export default withPermissionCheck(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    const userId = (req as any).session?.userid;

    try {
      const sessions = await prisma.session.findMany({
        where: {
          sessionType: {
            workspaceGroupId: parseInt(id as string),
          },
        },
        include: {
          owner: true,
          sessionType: {
            include: {
              schedule: true,
            },
          },
          users: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      let userRole = null;
      if (userId) {
        const user = await prisma.user.findFirst({
          where: { userid: BigInt(userId) },
          include: {
            roles: {
              where: { workspaceGroupId: parseInt(id as string) },
              orderBy: { isOwnerRole: "desc" },
            },
          },
        });
        userRole = user?.roles?.[0];
      }

      const visibilityFilters = await getConfig(
        "session_filters",
        parseInt(id as string)
      );

      let filteredSessions = sessions;
      if (
        visibilityFilters &&
        userRole &&
        !userRole.isOwnerRole &&
        !userRole.permissions?.includes("admin")
      ) {
        const roleId = userRole.id;
        const allowedTypes = visibilityFilters[roleId];

        if (allowedTypes && Array.isArray(allowedTypes)) {
          filteredSessions = sessions.filter((session) =>
            allowedTypes.includes(session.type)
          );
        }
      }

      const serializedSessions = JSON.parse(
        JSON.stringify(filteredSessions, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      );
      res.status(200).json(serializedSessions);
    } catch (error) {
      console.error("Error fetching all sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  }
);