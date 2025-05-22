import type { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from "@/lib/withSession";
import prisma from "@/utils/database";
import bcryptjs from "bcryptjs";
import * as noblox from "noblox.js";
import { getRobloxThumbnail } from "@/utils/roblox";

type Data = {
  success: boolean;
  error?: string;
  code?: number;
  debug?: any;
};

// Safe password hashing function
async function safeHashPassword(password: string): Promise<string> {
  try {
    return await bcryptjs.hash(password, 10);
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Failed to hash password");
  }
}

export default withSessionRoute(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  try {
    // Method check
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ success: false, error: "Method not allowed", code: 405 });
    }

    // Verification check
    const verification = req.session.verification;
    if (!verification) {
      return res
        .status(400)
        .json({ success: false, error: "Missing verification", code: 400 });
    }

    const { userid, verificationCode } = verification;

    // Get user info
    const user = await noblox.getPlayerInfo(userid);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid user", code: 400 });
    }

    // Verify code in blurb
    if (!user.blurb.includes(verificationCode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code",
        code: 400,
        debug: { blurb: user.blurb, code: verificationCode },
      });
    }

    const password = req.body.password;
    if (!password) {
      return res
        .status(400)
        .json({ success: false, error: "Password is required", code: 400 });
    }

    // Handle session - create a new session instead of destroying and recreating
    req.session.userid = userid;
    await req.session.save();

    // Get thumbnail
    let thumbnail = await getRobloxThumbnail(userid);
    if (!thumbnail) thumbnail = undefined;

    try {
      // Hash password once to reuse
      const hashedPassword = await safeHashPassword(password);

      // Update or create user with explicit registered field
      await prisma.user.upsert({
        where: {
          userid: BigInt(userid),
        },
        update: {
          username: user.username || undefined,
          picture: thumbnail,
          registered: true,
          info: {
            upsert: {
              create: {
                passwordhash: hashedPassword,
              },
              update: {
                passwordhash: hashedPassword,
              },
            },
          },
        },
        create: {
          userid: BigInt(userid),
          username: user.username || undefined,
          picture: thumbnail,
          registered: true, // Explicitly set registered to true
          info: {
            create: {
              passwordhash: hashedPassword,
            },
          },
        },
      });

      // Return success with explicit code
      return res.status(200).json({ success: true, code: 200 });
    } catch (prismaError) {
      console.error("Prisma error:", prismaError);

      try {
        // Hash password once to reuse
        const hashedPassword = await safeHashPassword(password);

        // Try a simplified create without nested relations if upsert fails
        await prisma.user.upsert({
          where: {
            userid: BigInt(userid),
          },
          update: {
            username: user.username || undefined,
            picture: thumbnail,
          },
          create: {
            userid: BigInt(userid),
            username: user.username || undefined,
            picture: thumbnail,
          },
        });

        // Then create password info separately
        await prisma.userInfo.upsert({
          where: {
            userid: BigInt(userid),
          },
          update: {
            passwordhash: hashedPassword,
          },
          create: {
            userid: BigInt(userid),
            passwordhash: hashedPassword,
          },
        });

        return res.status(200).json({ success: true, code: 200 });
      } catch (error) {
        console.error("Fallback creation error:", error);
        throw error; // Re-throw to be caught by outer catch
      }
    }
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      code: 500,
      debug: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}