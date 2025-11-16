import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

export default withPermissionCheck(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;

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

      const serializedSessions = JSON.parse(
        JSON.stringify(sessions, (key, value) =>
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