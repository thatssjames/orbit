import type { NextApiRequest, NextApiResponse } from "next";
import { setConfig, getConfig } from "@/utils/configEngine";
import { logAudit } from '@/utils/logs';
import { getUsername } from '@/utils/userinfoEngine';
import { withPermissionCheck } from '@/utils/permissionsManager';

type SessionColors = {
  recurring: string;
  shift: string;
  training: string;
  event: string;
  other: string;
};

type Data = {
  success: boolean;
  error?: string;
  colors?: SessionColors;
};

export default withPermissionCheck(handler, 'admin');

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceId = parseInt(req.query.id as string);

  if (!workspaceId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing workspace ID" });
  }

  if (req.method === "GET") {
    try {
      const sessionColors = await getConfig("sessionColors", workspaceId);
      const defaultColors: SessionColors = {
        recurring: "bg-blue-500",
        shift: "bg-green-500",
        training: "bg-yellow-500",
        event: "bg-purple-500",
        other: "bg-zinc-500",
      };

      return res.status(200).json({
        success: true,
        colors: sessionColors || defaultColors,
      });
    } catch (error) {
      console.error("Failed to get session colors:", error);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  }

  if (req.method === "PATCH") {
    const colors = req.body.colors as SessionColors;
    if (!colors) {
      return res
        .status(400)
        .json({ success: false, error: "Missing colors data" });
    }

    const validColors = ["recurring", "shift", "training", "event", "other"];
    for (const colorType of validColors) {
      if (
        !colors[colorType as keyof SessionColors] ||
        !colors[colorType as keyof SessionColors].startsWith("bg-")
      ) {
        return res.status(400).json({
          success: false,
          error: `Invalid color format for ${colorType}`,
        });
      }
    }

    try {
      const before = await getConfig('sessionColors', workspaceId);
      await setConfig("sessionColors", colors, workspaceId);
      try {
        const actorId = (req as any).session?.userid ? Number((req as any).session.userid) : null;
        const actorUsername = actorId ? await getUsername(actorId).catch(() => null) : null;
        await logAudit(workspaceId, actorId, 'settings.general.sessionColors.update', 'sessionColors', { before, after: colors, actorUsername });
      } catch (e) {}

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Failed to save session colors:", error);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
