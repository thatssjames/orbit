import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";

const roleAssignmentLimits: { [key: string]: { count: number; resetTime: number } } = {};
function checkRoleAssignmentRateLimit(req: NextApiRequest, res: NextApiResponse): boolean {
  const workspaceId = req.query?.id || 'unknown';
  const userId = (req as any).session?.userid || 'anonymous';
  const key = `workspace:${workspaceId}:user:${userId}`;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;

  let entry = roleAssignmentLimits[key];
  if (!entry || now >= entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs };
    roleAssignmentLimits[key] = entry;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    res.status(429).json({
      success: false,
      error: 'Too many role assignment attempts. Please wait a moment before making more changes.'
    });
    return false;
  }
  return true;
}

type Data = {
  success: boolean;
  error?: string;
};

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (!checkRoleAssignmentRateLimit(req, res)) return;
  
  if (req.method !== "PUT") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const { sid } = req.query;
  const { ownerId } = req.body;

  if (!sid) {
    return res
      .status(400)
      .json({ success: false, error: "Session ID is required" });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid as string },
    });

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    if (ownerId) {
      const user = await prisma.user.findUnique({
        where: { userid: BigInt(ownerId) },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }
    }

    await prisma.session.update({
      where: { id: sid as string },
      data: {
        ownerId: ownerId ? BigInt(ownerId) : null,
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error updating session host:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export default withSessionRoute(handler);
