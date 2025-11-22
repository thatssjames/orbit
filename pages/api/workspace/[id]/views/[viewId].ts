import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";

async function hasManageViewsPermission(req: NextApiRequest, workspaceId: number) {
  if (!req.session?.userid) return false;
  const user = await prisma.user.findFirst({
    where: { userid: BigInt(req.session.userid) },
    include: {
      roles: {
        where: { workspaceGroupId: workspaceId },
        orderBy: { isOwnerRole: "desc" },
      },
    },
  });
  if (!user || !user.roles.length) return false;
  const role = user.roles[0];
  // Allow if owner OR has the manage_views permission
  return !!(role.isOwnerRole || (role.permissions || []).includes("manage_views"));
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = Number(req.query.id as string);
  const viewId = String(req.query.viewId as string);
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" });
  if (!viewId) return res.status(400).json({ success: false, error: "Missing view ID" });

  try {
    if (req.method === "DELETE") {
      // require manage_views or owner
      const ok = await hasManageViewsPermission(req, workspaceId);
      if (!ok) return res.status(401).json({ success: false, error: "Unauthorized" });

      // Ensure the view belongs to this workspace, then delete
      const deleted = await prisma.savedView.deleteMany({ where: { id: viewId, workspaceGroupId: workspaceId } });
      if (deleted.count === 0) return res.status(404).json({ success: false, error: "View not found" });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (e) {
    console.error("Saved view DELETE error:", e);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export default withSessionRoute(handler);
