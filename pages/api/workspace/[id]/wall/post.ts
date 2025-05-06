// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { fetchworkspace, getConfig, setConfig } from "@/utils/configEngine";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { withSessionRoute } from "@/lib/withSession";
import {
  getUsername,
  getThumbnail,
  getDisplayName,
} from "@/utils/userinfoEngine";
import * as noblox from "noblox.js";
import DOMPurify from "isomorphic-dompurify";

type Data = {
  success: boolean;
  error?: string;
  post?: any;
};

export default withPermissionCheck(handler, "post_on_wall");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  if (!req.session.userid)
    return res.status(401).json({ success: false, error: "Not logged in" });
  if (!req.body?.content)
    return res.status(400).json({ success: false, error: "Missing content" });

  try {
    let { content, image } = req.body;

    // Sanitize content with DOMPurify to prevent XSS
    content = DOMPurify.sanitize(content.toString().trim(), {
      ALLOWED_TAGS: [], // No HTML tags allowed in content
      ALLOWED_ATTR: [], // No attributes allowed
    });

    // Validate image (if present)
    if (image) {
      // Validate that it's a data URL for an allowed image type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];

      // Basic validation
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return res.status(400).json({
          success: false,
          error: "Invalid image format",
        });
      }

      // Extract mime type from data URL
      const mimeMatch = image.match(/^data:([^;]+);base64,/);
      if (!mimeMatch || !allowedTypes.includes(mimeMatch[1])) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid image type. Only JPEG, PNG, GIF, and WEBP are supported.",
        });
      }

      // Check size (roughly - base64 is ~33% larger than binary)
      // Limit to ~5MB (accounting for base64 overhead)
      const base64Data = image.split(",")[1] || "";
      if (base64Data.length > 7 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: "Image too large. Maximum size is 5MB.",
        });
      }

      // Sanitize the image URL with DOMPurify's URI sanitizer
      image = DOMPurify.sanitize(image);
    }

    const post = await prisma.wallPost.create({
      data: {
        content,
        image: image || undefined,
        authorId: req.session.userid,
        workspaceGroupId: parseInt(req.query.id as string),
      },
      include: {
        author: {
          select: {
            username: true,
            picture: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      post: JSON.parse(
        JSON.stringify(post, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ),
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
}
