import { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from "@/lib/withSession";

// Deprecated endpoint
export default withSessionRoute(async (req: NextApiRequest, res: NextApiResponse) => {
  return res.status(410).json({
    error: "Deprecated endpoint. Use workspace membership endpoints instead.",
    deprecated: true
  });
});