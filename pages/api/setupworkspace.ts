// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import {
  getUsername,
  getThumbnail,
  getDisplayName,
} from "@/utils/userinfoEngine";
import { User } from "@/types/index.d";
import { PrismaClient } from "@prisma/client";
import * as noblox from "noblox.js";
import { withSessionRoute } from "@/lib/withSession";
import * as bcrypt from "bcrypt";
import { setRegistry } from "@/utils/registryManager";
import {
  getRobloxUsername,
  getRobloxThumbnail,
  getRobloxDisplayName,
  getRobloxUserId,
} from "@/utils/roblox";

// Initialize Prisma with proper configuration
const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

type Data = {
  success: boolean;
  error?: string;
  user?: User & { isOwner: boolean };
};

type requestData = {
  groupid: number;
  username: string;
  password: string;
  color: string;
};

export default withSessionRoute(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    // Add timeout for Roblox API call
    const userid = (await Promise.race([
      getRobloxUserId(req.body.username, req.headers.origin),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Roblox API timeout")), 10000)
      ),
    ]).catch((e) => {
      console.error("Roblox API error:", e);
      return null;
    })) as number | undefined;

    if (!userid) {
      console.error("Username not found or API timeout");
      return res
        .status(404)
        .json({ success: false, error: "Username not found" });
    }

    // Check workspace count
    const workspaceCount = await prisma.workspace.count({});
    if (workspaceCount > 0) {
      return res
        .status(403)
        .json({ success: false, error: "Workspace already exists" });
    }

    // Wrap all database operations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create workspace
      await tx.workspace.create({
        data: {
          groupId: parseInt(req.body.groupid),
        },
      });

      // Initialize all required configs
      await Promise.all([
        tx.config.create({
          data: {
            key: "customization",
            workspaceGroupId: parseInt(req.body.groupid),
            value: {
              color: req.body.color,
            },
          },
        }),
        tx.config.create({
          data: {
            key: "theme",
            workspaceGroupId: parseInt(req.body.groupid),
            value: req.body.color,
          },
        }),
        tx.config.create({
          data: {
            key: "guides",
            workspaceGroupId: parseInt(req.body.groupid),
            value: {
              enabled: true,
            },
          },
        }),
        tx.config.create({
          data: {
            key: "sessions",
            workspaceGroupId: parseInt(req.body.groupid),
            value: {
              enabled: true,
            },
          },
        }),
        tx.config.create({
          data: {
            key: "home",
            workspaceGroupId: parseInt(req.body.groupid),
            value: {
              widgets: [],
            },
          },
        }),
      ]);

      // Create role
      const role = await tx.role.create({
        data: {
          workspaceGroupId: parseInt(req.body.groupid),
          name: "Admin",
          isOwnerRole: true,
          permissions: [
            "admin",
            "view_staff_config",
            "manage_sessions",
            "manage_activity",
            "post_on_wall",
            "view_wall",
            "view_members",
            "manage_members",
            "manage_docs",
            "view_entire_groups_activity",
          ],
        },
      });

      // Create user with hashed password
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      await tx.user.create({
        data: {
          userid: userid,
          isOwner: true,
          registered: true,
          info: {
            create: {
              passwordhash: hashedPassword,
            },
          },
          roles: {
            connect: {
              id: role.id,
            },
          },
        },
      });

      return { userid, role };
    });

    // Set session
    req.session.userid = result.userid;
    await req.session?.save();

    // Get user info
    const user: User & { isOwner: boolean } = {
      userId: req.session.userid,
      username: await getUsername(req.session.userid),
      displayname: await getDisplayName(req.session.userid),
      thumbnail: await getThumbnail(req.session.userid),
      isOwner: true,
    };

    // Set registry
    await setRegistry(req.headers.host as string);

    // Clear session and redirect
    req.session.destroy();
    return res.redirect("/login");
  } catch (error) {
    console.error("Setup workspace error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
