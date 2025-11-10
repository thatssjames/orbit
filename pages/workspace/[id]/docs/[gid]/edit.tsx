import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Button from "@/components/button";
import Input from "@/components/input";
import Workspace from "@/layouts/workspace";
import { useRecoilState } from "recoil";
import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  IconCheck,
  IconChevronDown,
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconBold,
  IconItalic,
  IconListDetails,
  IconArrowLeft,
  IconLock,
  IconTrash,
} from "@tabler/icons-react";
import { useRouter } from "next/router";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import axios from "axios";
import prisma from "@/utils/database";
import { useForm, FormProvider } from "react-hook-form";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import clsx from "clsx";
import { Toaster, toast } from "react-hot-toast";

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(
  async (context) => {
    const { id, gid } = context.query;
    if (!gid) return { notFound: true };

    const [roles, document] = await Promise.all([
      prisma.role.findMany({
        where: {
          workspaceGroupId: Number(id),
        },
        orderBy: {
          isOwnerRole: "desc",
        },
      }),
      prisma.document.findUnique({
        where: {
          id: gid as string,
        },
        include: {
          roles: true,
        },
      }),
    ]);

    if (!document) return { notFound: true };

    return {
      props: {
        roles,
        document: JSON.parse(
          JSON.stringify(document, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
      },
    };
  },
  "manage_docs"
);

const EditDoc: pageWithLayout<any> = ({ roles, document }) => {
  const [login, setLogin] = useRecoilState(loginState);
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    document.roles.map((role: any) => role.id)
  );
  const [mode, setMode] = useState<"internal" | "external">(() => {
    if (document.content && (document.content as any).external)
      return "external";
    return "internal";
  });
  const convertNodeToMarkdown = (node: any): string => {
    if (!node) return "";
    switch (node.type) {
      case "doc":
        return (node.content || []).map(convertNodeToMarkdown).join("\n\n");
      case "paragraph":
        return (node.content || []).map(convertNodeToMarkdown).join("");
      case "heading": {
        const level = node.attrs?.level || 1;
        const text = (node.content || []).map(convertNodeToMarkdown).join("");
        return `${"#".repeat(level)} ${text}`;
      }
      case "text": {
        let txt = node.text || "";
        if (node.marks) {
          for (const mark of node.marks) {
            if (mark.type === "bold") txt = `**${txt}**`;
            if (mark.type === "italic") txt = `*${txt}*`;
            if (mark.type === "code") txt = `\`${txt}\``;
          }
        }
        return txt;
      }
      case "bulletList":
        return (node.content || [])
          .map((li: any) => {
            const inner = (li.content || [])
              .map(convertNodeToMarkdown)
              .join("");
            return `- ${inner}`;
          })
          .join("\n");
      case "orderedList":
        return (node.content || [])
          .map((li: any, idx: number) => {
            const inner = (li.content || [])
              .map(convertNodeToMarkdown)
              .join("");
            return `${idx + 1}. ${inner}`;
          })
          .join("\n");
      case "codeBlock":
        return (
          "\n\n```" +
          (node.content && node.content[0] ? node.content[0].text || "" : "") +
          "```\n\n"
        );
      case "blockquote":
        return (node.content || [])
          .map(convertNodeToMarkdown)
          .map((l: string) => `> ${l}`)
          .join("\n");
      case "hardBreak":
        return "\n";
      default:
        return (node.content || []).map(convertNodeToMarkdown).join("");
    }
  };

  const convertOldToMarkdown = (html: string): string => {
    if (!html) return "";
    let s = html;
    for (let i = 6; i >= 1; i--) {
      s = s.replace(
        new RegExp(`<h${i}[^>]*>([\s\S]*?)<\/h${i}>`, "gi"),
        (_m, p1) => `${"#".repeat(i)} ${p1.trim()}`
      );
    }
    s = s.replace(
      /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi,
      (_m, p1) => `**${p1.trim()}**`
    );
    s = s.replace(
      /<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi,
      (_m, p1) => `*${p1.trim()}*`
    );
    s = s.replace(
      /<a[^>]*href=["']?([^"' >]+)["']?[^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href, text) => {
        return `[${text.trim()}](${href.trim()})`;
      }
    );
    s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner) => {
      return inner
        .replace(
          /<li[^>]*>([\s\S]*?)<\/li>/gi,
          (_mi: any, li: any) => `- ${li.trim()}`
        )
        .trim();
    });
    s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner) => {
      let idx = 1;
      return inner
        .replace(
          /<li[^>]*>([\s\S]*?)<\/li>/gi,
          (_mi: any, li: any) => `${idx++}. ${li.trim()}`
        )
        .trim();
    });
    s = s.replace(
      /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_m, code) => `\n\n\`\`\`\n${code.replace(/<[^>]+>/g, "")}\n\`\`\`\n\n`
    );
    s = s.replace(
      /<code[^>]*>([\s\S]*?)<\/code>/gi,
      (_m, code) => "`" + code.replace(/<[^>]+>/g, "") + "`"
    );
    s = s.replace(/<br\s*\/?>(\s*)/gi, "\n");
    s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, p1) => `${p1.trim()}\n\n`);
    s = s.replace(/<[^>]+>/g, "");
    s = s.replace(/&nbsp;/g, " ");
    s = s.replace(/&amp;/g, "&");
    s = s.replace(/&lt;/g, "<");
    s = s.replace(/&gt;/g, ">");
    s = s.replace(/\n{3,}/g, "\n\n");
    return s.trim();
  };

  const initialMarkdown = (() => {
    if (typeof document.content === "string") {
      const s = String(document.content);
      const looksLikeHtml = /<[^>]+>/.test(s);
      if (looksLikeHtml) return convertOldToMarkdown(s);
      return s;
    }
    try {
      return convertNodeToMarkdown(document.content as any) || "";
    } catch (e) {
      return "";
    }
  })();

  const [markdownContent, setMarkdownContent] =
    useState<string>(initialMarkdown);
  const [externalUrl, setExternalUrl] = useState<string>(() =>
    document.content && (document.content as any).external
      ? (document.content as any).url || ""
      : ""
  );
  const markdownRef = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();
  const form = useForm({
    defaultValues: {
      name: document.name,
    },
  });

  const editor = useEditor({
    extensions: [StarterKit],
    editable: false,
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert max-w-none focus:outline-none",
      },
    },
    content:
      typeof document.content === "string"
        ? document.content
        : document.content,
  });

  const goback = () => {
    router.push(`/workspace/${workspace.groupId}/docs`);
  };

  const updateDoc = async () => {
    let content: any = null;
    if (mode === "external") {
      if (!externalUrl.trim()) {
        form.setError("name", {
          type: "custom",
          message: "External URL required",
        });
        return;
      }
      content = {
        external: true,
        url: externalUrl.trim(),
        title: form.getValues().name,
      };
    } else {
      content = markdownContent;
    }

    const session = await axios
      .post(
        `/api/workspace/${workspace.groupId}/guides/${document.id}/update`,
        {
          name: form.getValues().name,
          content,
          roles: selectedRoles,
        }
      )
      .catch((err) => {
        form.setError("name", {
          type: "custom",
          message: err?.response?.data?.error || "Failed to update",
        });
      });
    if (!session) return;
    form.clearErrors();
    if (mode === "external") {
      toast.success("Saved");
      router.push(`/workspace/${workspace.groupId}/docs`);
    } else {
      toast.success("Saved");
      router.push(`/workspace/${workspace.groupId}/docs/${document.id}`);
    }
  };

  const toggleRole = async (role: string) => {
    setSelectedRoles((prevRoles) => {
      if (prevRoles.includes(role)) {
        return prevRoles.filter((r) => r !== role);
      } else {
        return [...prevRoles, role];
      }
    });
  };

  const buttons = {
    heading: [
      {
        icon: IconH1,
        function: () =>
          editor?.chain().focus().toggleHeading({ level: 1 }).run(),
        active: () => editor?.isActive("heading", { level: 1 }),
      },
      {
        icon: IconH2,
        function: () =>
          editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        active: () => editor?.isActive("heading", { level: 2 }),
      },
      {
        icon: IconH3,
        function: () =>
          editor?.chain().focus().toggleHeading({ level: 3 }).run(),
        active: () => editor?.isActive("heading", { level: 3 }),
      },
      {
        icon: IconH4,
        function: () =>
          editor?.chain().focus().toggleHeading({ level: 4 }).run(),
        active: () => editor?.isActive("heading", { level: 4 }),
      },
    ],
    util: [
      {
        icon: IconBold,
        function: () => editor?.chain().focus().toggleBold().run(),
        active: () => editor?.isActive("bold"),
      },
      {
        icon: IconItalic,
        function: () => editor?.chain().focus().toggleItalic().run(),
        active: () => editor?.isActive("italic"),
      },
    ],
    list: [
      {
        icon: IconListDetails,
        function: () => editor?.chain().focus().toggleBulletList().run(),
        active: () => editor?.isActive("bulletList"),
      },
    ],
  };

  const confirmDelete = async () => {
  if (!document.id) return;

  try {
    await axios.post(`/api/workspace/${workspace.groupId}/guides/${document.id}/delete`);
	toast.success("Deleted document!");
  } catch (e: any) {
    console.error(e);
    toast.error("Failed to delete document.");
  } finally {
    setShowDeleteModal(false);
    router.push(`/workspace/${workspace.groupId}/docs`);
  }
  };

  const insertMarkdown = (tokenBefore: string, tokenAfter = tokenBefore) => {
    const el = markdownRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.substring(start, end);
    const newVal =
      el.value.substring(0, start) +
      tokenBefore +
      selected +
      tokenAfter +
      el.value.substring(end);
    setMarkdownContent(newVal);
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + tokenBefore.length;
      el.selectionEnd = end + tokenBefore.length;
    }, 0);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Toaster position="bottom-center" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push(`/workspace/${workspace.groupId}/docs`)}
            className="p-2 text-zinc-500 dark:text-zinc-300 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Go back"
          >
            <IconArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-medium text-zinc-900 dark:text-white">
              Edit Document
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-300">
              Update your workspace documentation
            </p>
          </div>
        </div>
        <div className="dark:bg-zinc-800 rounded-lg mb-6">
          <FormProvider {...form}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* Document Info */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-zinc-700 rounded-lg shadow-sm p-4">
                  <h2 className="text-base font-medium text-zinc-900 dark:text-white mb-3">
                    Document Information
                  </h2>
                  <Input
                    {...form.register("name", {
                      required: {
                        value: true,
                        message: "Document name is required",
                      },
                    })}
                    label="Document Name"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-zinc-700 rounded-lg shadow-sm p-4">
                  <h2 className="text-base font-medium text-zinc-900 dark:text-white mb-3">
                    Permissions
                  </h2>
                  <div className="space-y-2">
                    {roles.map((role: any) => (
                      <label
                        key={role.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-500 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role.id)}
                          onChange={() => toggleRole(role.id)}
                          className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                        />
                        <span className="text-sm text-zinc-700 dark:text-white">
                          {role.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {mode === "internal" && (
              <div className="bg-white dark:bg-zinc-700 rounded-lg shadow-sm p-4 mb-4">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => insertMarkdown("**", "**")}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                    aria-label="Bold"
                  >
                    <IconBold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => insertMarkdown("*", "*")}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                    aria-label="Italic"
                  >
                    <IconItalic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => insertMarkdown("# ")}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                    aria-label="Heading 1"
                  >
                    <IconH1 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => insertMarkdown("- ")}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                    aria-label="List"
                  >
                    <IconListDetails className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  ref={markdownRef}
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                  className="w-full h-64 p-3 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                />
              </div>
            )}
            {mode === "external" && (
              <div className="bg-white dark:bg-zinc-700 rounded-lg shadow-sm p-4 mb-4">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">
                  External Document
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300 mb-2">
                  This document points to an external URL — edit it here to
                  update the link.
                </p>
                <Input
                  name="externalUrl"
                  value={externalUrl}
                  onChange={async (e: any) => {
                    setExternalUrl(e.target.value);
                  }}
                  onBlur={async () => {}}
                  placeholder="https://docs.planetaryapp.us/"
                  label="External URL"
                />
              </div>
            )}
            <div className="bg-white dark:bg-zinc-700 rounded-lg shadow-sm p-4 mb-4">
              <EditorContent editor={editor} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={form.handleSubmit(updateDoc)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 transition-colors"
              >
                <IconCheck className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
              >
                <IconTrash className="w-4 h-4" />
                Delete
              </button>
            </div>
          </FormProvider>
        </div>
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Confirm Deletion
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              Are you sure you want to delete this Document? This action cannot be
              undone.
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

EditDoc.layout = Workspace;

export default EditDoc;
