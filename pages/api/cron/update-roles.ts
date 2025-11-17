import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { checkGroupRoles } from "@/utils/permissionsManager";

type Resp = {
  success: boolean;
  started?: number;
  workspaces?: number[];
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const secret = req.headers["x-cron-secret"] || req.headers.authorization;
  const expected = process.env.CRON_SECRET;
  if (!expected) return res.status(500).json({ success: false, error: "CRON_SECRET not configured" });
  if (!secret || String(secret) !== expected) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    const qid = req.query.id as string | undefined;
    const bodyId = (req.body && (req.body.workspaceId || req.body.id)) as number | string | undefined;
    const requestedId = qid || bodyId;

    if (requestedId) {
      const workspaceId = parseInt(String(requestedId));
      if (isNaN(workspaceId)) return res.status(400).json({ success: false, error: "Invalid workspace ID" });
      checkGroupRoles(workspaceId).catch((e) => console.error("checkgrouproles cron error:", e));
      return res.status(200).json({ success: true, started: 1, workspaces: [workspaceId] });
    }

    const ws = await prisma.workspace.findMany({});
    const ids: number[] = [];
    for (const w of ws) {
      ids.push(w.groupId);
      checkGroupRoles(w.groupId).catch((e) => console.error("checkgrouproles cron error for", w.groupId, e));
    }

    return res.status(200).json({ success: true, started: ids.length, workspaces: ids });
  } catch (e: any) {
    console.error("Cron checkgrouproles error:", e);
    return res.status(500).json({ success: false, error: String(e?.message || e) });
  }
}
