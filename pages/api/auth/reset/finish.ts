import { withSessionRoute } from "@/lib/withSession";
import prisma from "@/utils/database";
import bcryptjs from "bcryptjs";
import * as noblox from "noblox.js";
import { NextApiRequest, NextApiResponse } from "next";

export default withSessionRoute(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  const verification = req.session.verification;
  if (!verification || !verification.isReset)
    return res.status(400).json({ success: false, error: "Invalid verification session" });

  const { userid, verificationCode } = verification;

  // Use getPlayerInfo to check the blurb
  const user = await noblox.getPlayerInfo(Number(userid)).catch(() => null);
  if (!user || !user.blurb || !user.blurb.includes(verificationCode)) {
    return res.status(400).json({ success: false, error: "Verification code not found in Roblox blurb" });
  }

  const password = req.body.password;
  if (!password) return res.status(400).json({ success: false, error: "Password is required" });

  const hash = await bcryptjs.hash(password, 10);
  await prisma.userInfo.update({
    where: { userid: BigInt(userid) },
    data: { passwordhash: hash },
  });

  delete req.session.verification;
  await req.session.save();

  res.status(200).json({ success: true });
});
