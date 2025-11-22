import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";
import { logAudit } from "@/utils/logs";

type Data = {
  success: boolean;
  error?: string;
};

export default withSessionRoute(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "DELETE")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  const { id, uid, entryId } = req.query;
  if (!id || !uid || !entryId)
    return res.status(400).json({ success: false, error: "Missing required fields" });

  const workspaceGroupId = parseInt(id as string);

  try {
    const currentUser = await prisma.user.findFirst({
      where: { userid: BigInt(req.session.userid as number) },
      include: {
        roles: {
          where: { workspaceGroupId: workspaceGroupId },
          orderBy: { isOwnerRole: "desc" },
        },
      },
    });

    if (!currentUser || !currentUser.roles || currentUser.roles.length === 0)
      return res.status(401).json({ success: false, error: "Unauthorized." });

    const userRole = currentUser.roles[0];
    if (!userRole.isOwnerRole)
      return res.status(401).json({ success: false, error: "Only owners may delete entries." });

    const entry = await prisma.userBook.findUnique({ where: { id: entryId as string } });
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found." });
    if (entry.workspaceGroupId !== workspaceGroupId)
      return res.status(403).json({ success: false, error: "WorkspaceID doesn't match." });

    await prisma.userBook.delete({ where: { id: entryId as string } });

    try {
      await logAudit(
        workspaceGroupId,
        req.session.userid || null,
        "userbook.delete",
        `userbook:${entryId}`,
        { entryId }
      );
    } catch (e) {}

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete entry" });
  }
}
