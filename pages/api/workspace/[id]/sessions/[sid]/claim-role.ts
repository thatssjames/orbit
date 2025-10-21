import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";

const roleAssignmentLimits: { [key: string]: { count: number; resetTime: number } } = {};
function checkRoleAssignmentRateLimit(req: NextApiRequest, res: NextApiResponse): boolean {
  const workspaceId = req.query?.id || 'unknown';
  const userId = (req as any).session?.userid || 'anonymous';
  const key = `workspace:${workspaceId}:user:${userId}`;
  const now = Date.now();
  const windowMs = 2 * 1000;
  const maxRequests = 10;

  let entry = roleAssignmentLimits[key];
  if (!entry || now >= entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs };
    roleAssignmentLimits[key] = entry;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    res.status(429).json({
      success: false,
      error: 'Too many role assignment requests. Slow down!'
    });
    return false;
  }
  return true;
}

type Data = {
  success: boolean;
  error?: string;
};

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (!checkRoleAssignmentRateLimit(req, res)) return;
  
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const { sid } = req.query;
  const { userId, roleId, slot, action } = req.body;

  if (!sid || !roleId || slot === undefined || !action) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required parameters" });
  }

  if (action !== "claim" && action !== "unclaim") {
    return res
      .status(400)
      .json({
        success: false,
        error: 'Invalid action. Must be "claim" or "unclaim"',
      });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid as string },
      include: {
        users: true,
        sessionType: true,
      },
    });

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    console.log(
      `Role ${action} attempt: session=${sid}, roleId=${roleId}, slot=${slot}, userId=${userId}`
    );

    if (action === "claim") {
      if (!userId) {
        return res
          .status(400)
          .json({
            success: false,
            error: "userId is required for claim action",
          });
      }

      const user = await prisma.user.findUnique({
        where: { userid: BigInt(userId) },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const existingClaim = await prisma.sessionUser.findFirst({
        where: {
          sessionid: sid as string,
          roleID: roleId,
          slot: slot,
        },
      });

      if (existingClaim && existingClaim.userid.toString() !== userId) {
        return res
          .status(400)
          .json({
            success: false,
            error: "This slot is already claimed by another user",
          });
      }

      await prisma.sessionUser.deleteMany({
        where: {
          userid: BigInt(userId),
          sessionid: sid as string,
        },
      });

      const result = await prisma.sessionUser.create({
        data: {
          userid: BigInt(userId),
          sessionid: sid as string,
          roleID: roleId,
          slot: slot,
        },
      });
    } else {
      const result = await prisma.sessionUser.deleteMany({
        where: {
          sessionid: sid as string,
          roleID: roleId,
          slot: slot,
        },
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error managing role claim:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export default withSessionRoute(handler);
