import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";

type Data = {
  success: boolean;
  error?: string;
};

export default withSessionRoute(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "DELETE")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  const { id, sid, noteId } = req.query;
  if (!id || !sid || !noteId)
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });

  try {
    const note = await prisma.sessionNote.findFirst({
      where: {
        id: noteId as string,
        sessionId: sid as string,
        session: {
          sessionType: {
            workspaceGroupId: parseInt(id as string),
          },
        },
      },
    });

    if (!note) {
      return res.status(404).json({ success: false, error: "Note not found" });
    }

    const user = await prisma.user.findUnique({
      where: {
        userid: BigInt(req.session.userid),
      },
      include: {
        roles: {
          where: {
            workspaceGroupId: parseInt(id as string),
          },
        },
      },
    });

    const isOwner = user?.roles.some((role) => role.isOwnerRole);
    const isAuthor = note.authorId.toString() === req.session.userid.toString();
    if (!isOwner && !isAuthor) {
      return res
        .status(403)
        .json({ success: false, error: "You can only delete your own notes" });
    }

    await prisma.sessionNote.delete({
      where: {
        id: noteId as string,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to delete note" });
  }
}
