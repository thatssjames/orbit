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
  // Log at the very beginning
  process.stdout.write(
    `\n[${new Date().toISOString()}] Setup workspace request received\n`
  );
  process.stdout.write(`Method: ${req.method}\n`);
  process.stdout.write(`Headers: ${JSON.stringify(req.headers, null, 2)}\n`);
  process.stdout.write(`Body: ${JSON.stringify(req.body, null, 2)}\n`);
  process.stdout.write(`Query: ${JSON.stringify(req.query, null, 2)}\n`);

  if (req.method !== "POST") {
    process.stdout.write(`Invalid method: ${req.method}\n`);
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  // Log raw body for debugging
  process.stdout.write(
    `Raw request body: ${JSON.stringify(req.body, null, 2)}\n`
  );
  process.stdout.write(
    `Request headers: ${JSON.stringify(req.headers, null, 2)}\n`
  );

  // Ensure body is parsed
  if (!req.body) {
    process.stdout.write("No request body found\n");
    return res
      .status(400)
      .json({ success: false, error: "No request body provided" });
  }

  // Parse and validate body
  let parsedBody;
  try {
    // If body is a string, try to parse it
    if (typeof req.body === "string") {
      parsedBody = JSON.parse(req.body);
    } else {
      parsedBody = req.body;
    }
    process.stdout.write(
      `Parsed body: ${JSON.stringify(parsedBody, null, 2)}\n`
    );
  } catch (e) {
    process.stdout.write(`Error parsing request body: ${e}\n`);
    return res
      .status(400)
      .json({ success: false, error: "Invalid JSON in request body" });
  }

  const { groupid, username, password, color } = parsedBody;

  // Log parsed fields
  console.log("Parsed fields:", { groupid, username, password, color });

  // Validate required fields
  if (!groupid || !username || !password || !color) {
    console.log("Missing required fields:", {
      groupid,
      username,
      password,
      color,
    });
    return res.status(400).json({
      success: false,
      error:
        "Missing required fields. Required: groupid, username, password, color",
    });
  }

  // Validate field types
  if (typeof groupid !== "number" && typeof groupid !== "string") {
    console.log("Invalid groupid type:", typeof groupid);
    return res
      .status(400)
      .json({ success: false, error: "groupid must be a number" });
  }

  // Convert groupid to number if it's a string
  const groupIdNumber =
    typeof groupid === "string" ? parseInt(groupid) : groupid;
  if (isNaN(groupIdNumber)) {
    console.log("Invalid groupid value:", groupid);
    return res
      .status(400)
      .json({ success: false, error: "groupid must be a valid number" });
  }

  if (typeof username !== "string") {
    console.log("Invalid username type:", typeof username);
    return res
      .status(400)
      .json({ success: false, error: "username must be a string" });
  }

  if (typeof password !== "string") {
    console.log("Invalid password type:", typeof password);
    return res
      .status(400)
      .json({ success: false, error: "password must be a string" });
  }

  if (typeof color !== "string") {
    console.log("Invalid color type:", typeof color);
    return res
      .status(400)
      .json({ success: false, error: "color must be a string" });
  }

  try {
    console.log("Starting Roblox API call for username:", username);
    // Add timeout for Roblox API call
    const userid = (await Promise.race([
      getRobloxUserId(username, req.headers.origin),
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

    console.log("Roblox user found:", userid);

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
          groupId: groupIdNumber,
        },
      });

      // Initialize all required configs
      await Promise.all([
        tx.config.create({
          data: {
            key: "customization",
            workspaceGroupId: groupIdNumber,
            value: {
              color: color,
            },
          },
        }),
        tx.config.create({
          data: {
            key: "theme",
            workspaceGroupId: groupIdNumber,
            value: color,
          },
        }),
        tx.config.create({
          data: {
            key: "guides",
            workspaceGroupId: groupIdNumber,
            value: {
              enabled: true,
            },
          },
        }),
        tx.config.create({
          data: {
            key: "sessions",
            workspaceGroupId: groupIdNumber,
            value: {
              enabled: true,
            },
          },
        }),
        tx.config.create({
          data: {
            key: "home",
            workspaceGroupId: groupIdNumber,
            value: {
              widgets: [],
            },
          },
        }),
      ]);

      // Create role
      const role = await tx.role.create({
        data: {
          workspaceGroupId: groupIdNumber,
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
      const hashedPassword = await bcrypt.hash(password, 10);
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
