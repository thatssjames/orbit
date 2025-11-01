// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { fetchworkspace, getConfig, setConfig } from "@/utils/configEngine";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";
import { withPermissionCheck } from "@/utils/permissionsManager";

import {
  getUsername,
  getThumbnail,
  getDisplayName,
} from "@/utils/userinfoEngine";
import * as noblox from "noblox.js";
type Data = {
  success: boolean;
  error?: string;
};

export default withPermissionCheck(handler, "manage_activity");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  if (!req.session.userid)
    return res.status(401).json({ success: false, error: "Not logged in" });

  const workspaceGroupId = Number(req.query.id as string);

  try {
    const earliestSession = await prisma.activitySession.findFirst({
      where: { workspaceGroupId },
      orderBy: { startTime: "asc" },
      select: { startTime: true },
    });

    const earliestAdjustment = await prisma.activityAdjustment.findFirst({
      where: { workspaceGroupId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    let periodStart = new Date();
    if (earliestSession && earliestAdjustment) {
      periodStart =
        earliestSession.startTime < earliestAdjustment.createdAt
          ? earliestSession.startTime
          : earliestAdjustment.createdAt;
    } else if (earliestSession) {
      periodStart = earliestSession.startTime;
    } else if (earliestAdjustment) {
      periodStart = earliestAdjustment.createdAt;
    }

    const periodEnd = new Date();
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: { workspaceGroupId },
      include: {
        user: {
          include: {
            roles: {
              where: { workspaceGroupId },
              include: { quotaRoles: { include: { quota: true } } },
            },
          },
        },
      },
    });
    const quotas = await prisma.quota.findMany({
      where: { workspaceGroupId },
    });
    const historyRecords: {
      userId: bigint;
      workspaceGroupId: number;
      periodStart: Date;
      periodEnd: Date;
      minutes: number;
      messages: number;
      sessionsHosted: number;
      sessionsAttended: number;
      idleTime: number;
      wallPosts: number;
      quotaProgress: any;
    }[] = [];

    for (const member of workspaceMembers) {
      const userId = member.userId;
      const sessions = await prisma.activitySession.findMany({
        where: {
          userId,
          workspaceGroupId,
          endTime: { not: null },
        },
      });

      let sessionMinutes = 0;
      let totalMessages = 0;
      let totalIdleTime = 0;

      sessions.forEach((session) => {
        if (session.endTime) {
          const duration = Math.round(
            (session.endTime.getTime() - session.startTime.getTime()) / 60000
          );
          sessionMinutes += duration;
        }
        totalMessages += session.messages || 0;
        totalIdleTime += Number(session.idleTime) || 0;
      });
      const adjustments = await prisma.activityAdjustment.findMany({
        where: { userId, workspaceGroupId },
      });

      const adjustmentMinutes = adjustments.reduce(
        (sum, adj) => sum + adj.minutes,
        0
      );
      const totalMinutes = sessionMinutes + adjustmentMinutes;
      
      const ownedSessions = await prisma.session.findMany({
        where: {
          ownerId: userId,
          sessionType: { workspaceGroupId },
          date: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });

      const allSessionParticipations = await prisma.sessionUser.findMany({
        where: {
          userid: userId,
          session: {
            sessionType: { workspaceGroupId },
            date: {
              gte: periodStart,
              lte: periodEnd,
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

      const wallPosts = await prisma.wallPost.findMany({
        where: {
          authorId: userId,
          workspaceGroupId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });
      const totalWallPosts = wallPosts.length;

      const quotaProgress: any = {};
      const userQuotas = member.user.roles
        .flatMap((role) => role.quotaRoles)
        .map((qr) => qr.quota);

      for (const quota of userQuotas) {
        let currentValue = 0;
        let percentage = 0;

        switch (quota.type) {
          case "mins":
            currentValue = totalMinutes;
            percentage = (totalMinutes / quota.value) * 100;
            break;
          case "sessions_hosted":
            currentValue = sessionsHosted;
            percentage = (sessionsHosted / quota.value) * 100;
            break;
          case "sessions_attended":
            currentValue = sessionsAttended;
            percentage = (sessionsAttended / quota.value) * 100;
            break;
        }

        quotaProgress[quota.id] = {
          value: currentValue,
          percentage: Math.min(percentage, 100),
          name: quota.name,
          type: quota.type,
          requirement: quota.value,
        };
      }

      if (
        totalMinutes > 0 ||
        totalMessages > 0 ||
        sessionsHosted > 0 ||
        sessionsAttended > 0 ||
        totalWallPosts > 0
      ) {
        historyRecords.push({
          userId,
          workspaceGroupId,
          periodStart,
          periodEnd,
          minutes: totalMinutes,
          messages: totalMessages,
          sessionsHosted,
          sessionsAttended,
          idleTime: Math.round(totalIdleTime / 60),
          wallPosts: totalWallPosts,
          quotaProgress,
        });
      }
    }
    await prisma.$transaction(async (tx) => {
      if (historyRecords.length > 0) {
        await tx.activityHistory.createMany({
          data: historyRecords,
        });
      }
      await tx.activityReset.create({
        data: {
          workspaceGroupId,
          resetById: req.session.userid,
          previousPeriodStart: periodStart,
          previousPeriodEnd: periodEnd,
        },
      });
      await tx.sessionUser.deleteMany({
        where: {
          session: {
            sessionType: { workspaceGroupId },
            date: { lte: new Date() },
          },
        },
      });
      await tx.activitySession.deleteMany({
        where: { workspaceGroupId },
      });
      await tx.activityAdjustment.deleteMany({
        where: { workspaceGroupId },
      });
      await tx.session.deleteMany({
        where: {
          sessionType: { workspaceGroupId },
          date: { lte: new Date() },
        },
      });
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
}
