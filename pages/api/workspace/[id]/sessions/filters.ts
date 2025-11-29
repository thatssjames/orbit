import type { NextApiRequest, NextApiResponse } from "next";
import { getConfig, setConfig } from "@/utils/configEngine";
import { withPermissionCheck } from "@/utils/permissionsManager";

type Data = {
  success: boolean;
  error?: string;
  filters?: any;
};

export default withPermissionCheck(handler, "admin");

export async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const workspaceId = parseInt(req.query.id as string);

  if (req.method === "GET") {
    try {
      const filters = await getConfig("session_filters", workspaceId);
      return res.status(200).json({
        success: true,
        filters: filters || {},
      });
    } catch (error) {
      console.error("Error fetching filters:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch filters",
      });
    }
  } else if (req.method === "POST" || req.method === "PUT") {
    try {
      const { filters } = req.body;

      if (!filters || typeof filters !== "object") {
        return res.status(400).json({
          success: false,
          error: "Invalid filters format",
        });
      }

      await setConfig("session_filters", filters, workspaceId);

      return res.status(200).json({
        success: true,
        filters,
      });
    } catch (error) {
      console.error("Error saving filters:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to save filters",
      });
    }
  } else {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }
}
