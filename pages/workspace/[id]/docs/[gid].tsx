import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Workspace from "@/layouts/workspace";
import { useState, useMemo, useEffect } from "react";
import prisma from "@/utils/database";
import { useRecoilState } from "recoil";
import axios from "axios";
import Button from "@/components/button";
import StarterKit from "@tiptap/starter-kit";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { generateHTML } from "@tiptap/html";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  IconArrowLeft,
  IconTrash,
  IconClock,
  IconUser,
  IconEdit,
} from "@tabler/icons-react";
import { Toaster, toast } from "react-hot-toast";
import clsx from "clsx";

type Props = {
  document: any;
};

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(
  async (context) => {
    const { gid } = context.query;
    if (!gid) return { notFound: true };
    const user = await prisma.user.findUnique({
      where: {
        userid: BigInt(context.req.session.userid),
      },
      include: {
        roles: {
          where: {
            workspaceGroupId: parseInt(context.query.id as string),
          },
        },
      },
    });
    const guide = await prisma.document
      .findUnique({
        where: {
          id: gid as string,
        },
        include: {
          owner: {
            select: {
              username: true,
              picture: true,
            },
          },
          roles: true,
        },
      })
      .catch(() => null);
    if (!guide) return { notFound: true };
    const userRoles = (user?.roles || []);
    const isOwner = userRoles.some((r: any) => r.isOwnerRole);
    const canManageDocs = userRoles.some((r: any) => r.permissions?.includes("manage_docs"));
    const hasRoleAccess = guide.roles.some((gr: any) =>
      userRoles.some((ur: any) => ur.id === gr.id)
    );

    if (!isOwner && !canManageDocs && !hasRoleAccess) return { notFound: true };

    return {
      props: {
        document: JSON.parse(
          JSON.stringify(guide, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
      },
    };
  }
);

const Settings: pageWithLayout<Props> = ({ document }) => {
  const [login, setLogin] = useRecoilState(loginState);
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const router = useRouter();
  const [wallMessage, setWallMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const friendlyDate = `${new Date(
    document.createdAt
  ).toLocaleDateString()} at ${new Date(
    document.createdAt
  ).toLocaleTimeString()}`;

  const output = useMemo(() => {
    try {
      if (typeof document.content === "string") {
        return { type: "markdown", content: document.content };
      }
      if (document.content && (document.content as any).external) {
        return { type: "external", content: document.content };
      }
      const html = generateHTML(document.content as Object, [StarterKit]);
      return { type: "html", content: html };
    } catch (e) {
      return { type: "markdown", content: String(document.content) };
    }
  }, [document.content]);

  useEffect(() => {
    try {
      if (output?.type === "external") {
        const target = `/workspace/${workspace.groupId}/docs`;
        if (router.asPath !== target) {
          router.replace(target);
        }
      }
    } catch (e) {
      // smyw
    }
  }, [output, router, workspace.groupId]);

  const deleteDoc = async () => {
    await axios.post(
      `/api/workspace/${workspace.groupId}/guides/${document.id}/delete`,
      {},
      {}
    );
    toast.success("Deleted");
    router.push(`/workspace/${workspace.groupId}/docs`);
  };

  const confirmDelete = async () => {
    await deleteDoc();
    setShowDeleteModal(false);
  };

  return (
    <div className="pagePadding">
      <Toaster position="bottom-center" />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() =>
                router.push(`/workspace/${workspace.groupId}/docs`)
              }
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <IconArrowLeft className="w-5 h-5 text-zinc-500" />
            </button>
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">
              {document.name}
            </h1>
          </div>

          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <IconUser className="w-4 h-4" />
              <span>Created by {document.owner.username}</span>
            </div>
            <div className="flex items-center gap-2">
              <IconClock className="w-4 h-4" />
              <span>Last updated {friendlyDate}</span>
            </div>
          </div>
        </div>

        {/* Document Content */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-8">
          <div className="prose dark:prose-invert max-w-none">
            {output.type === "html" && (
              <div dangerouslySetInnerHTML={{ __html: output.content }} />
            )}
            {output.type === "markdown" && (
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                {output.content}
              </ReactMarkdown>
            )}
            {output.type === "external" && (
              <div className="">

              </div>
            )}
          </div>
        </div>
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Confirm Deletion
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              Are you sure you want to delete this Document? This action cannot
              be undone.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

Settings.layout = Workspace;

export default Settings;
