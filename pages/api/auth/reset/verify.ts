import { withSessionRoute } from "@/lib/withSession";
import * as noblox from "noblox.js";
import { NextApiRequest, NextApiResponse } from "next";

export default withSessionRoute(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const verification = req.session.verification;
  if (!verification || !verification.isReset) {
    return res.status(400).json({ success: false, error: "Invalid verification session" });
  }

  const { userid, verificationCode } = verification;
  const user = await noblox.getPlayerInfo(userid).catch(() => null);

  if (!user || !user.blurb.includes(verificationCode)) {
    return res.status(400).json({ success: false, error: "Verification code does not match" });
  }

  res.status(200).json({ success: true });
});
