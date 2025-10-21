import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

export default withPermissionCheck(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { id, sid } = req.query;
    const { date, slotId, slotIndex, timezoneOffset } = req.body;

    if (
      !date ||
      !slotId ||
      slotIndex === undefined ||
      timezoneOffset === undefined
    ) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      const schedule = await prisma.schedule.findUnique({
        where: { id: sid as string },
        include: {
          sessionType: true,
        },
      });

      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      const sessionDate = new Date(parseInt(date));
      sessionDate.setMinutes(sessionDate.getMinutes() + timezoneOffset);
      sessionDate.setUTCHours(schedule.Hour);
      sessionDate.setUTCMinutes(schedule.Minute);
      sessionDate.setUTCSeconds(0);
      sessionDate.setUTCMilliseconds(0);

      const session = await prisma.session.findFirst({
        where: {
          scheduleId: schedule.id,
          date: sessionDate,
        },
      });

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      await prisma.sessionUser.deleteMany({
        where: {
          sessionid: session.id,
          roleID: slotId,
          slot: slotIndex,
        },
      });

      const updatedSession = await prisma.session.findUnique({
        where: { id: session.id },
        include: {
          users: {
            include: {
              user: true,
            },
          },
          owner: true,
        },
      });

      res.status(200).json({ session: updatedSession });
    } catch (error) {
      console.error("Error unassigning slot:", error);
      res.status(500).json({ error: "Failed to unassign slot" });
    }
  },
  "manage_sessions"
);
