import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { validateApiKey } from "@/utils/api-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey)
    return res.status(401).json({ success: false, error: "Missing API key" });

  const workspaceId = Number.parseInt(req.query.id as string);
  if (!workspaceId)
    return res
      .status(400)
      .json({ success: false, error: "Missing workspace ID" });

  const { limit = "100", search } = req.query;

  try {
    const key = await validateApiKey(apiKey, workspaceId.toString());
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const where: any = {
      workspaceGroupId: workspaceId,
    };

    if (search) {
      where.user = {
        username: {
          contains: search as string,
          mode: "insensitive",
        },
      };
    }

    const members = await prisma.workspaceMember.findMany({
      where,
      include: {
        user: {
          select: {
            userid: true,
            username: true,
            picture: true,
          },
        },
      },
      orderBy: {
        joinDate: "desc",
      },
      take: Number(limit),
    });

    const formattedMembers = members.map((member) => ({
      userId: Number(member.user.userid),
      username: member.user.username,
      thumbnail: member.user.picture,
      joinDate: member.joinDate,
      birthdayDay: member.birthdayDay,
      birthdayMonth: member.birthdayMonth,
    }));

    return res.status(200).json({
      success: true,
      members: formattedMembers,
      total: formattedMembers.length,
    });
  } catch (error) {
    console.error("Error in public API:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}
