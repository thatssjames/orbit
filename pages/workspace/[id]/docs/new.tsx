import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Button from "@/components/button";
import Input from "@/components/input";
import Workspace from "@/layouts/workspace";
import { useRecoilState } from "recoil";
import { useState, useRef } from "react";
import {
  IconCheck,
  IconH1,
  IconH2,
  IconH3,
  IconBold,
  IconItalic,
  IconListDetails,
  IconArrowLeft,
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
    const { id } = context.query;

    const roles = await prisma.role.findMany({
      where: {
        workspaceGroupId: Number(id),
      },
      orderBy: {
        isOwnerRole: "desc",
      },
    });

    return {
      props: {
        roles,
      },
    };
  },
  "manage_docs"
);

const Home: pageWithLayout<InferGetServerSidePropsType<GetServerSideProps>> = ({
  roles,
}) => {
  const [login, setLogin] = useRecoilState(loginState);
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const router = useRouter();
  const form = useForm();

  const [mode, setMode] = useState<"internal" | "external">("internal");
  const [showTypeModal, setShowTypeModal] = useState<boolean>(true);
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [externalUrl, setExternalUrl] = useState<string>("");

  const markdownRef = useRef<HTMLTextAreaElement | null>(null);

  const goback = () => {
    window.history.back();
  };

  const chooseType = (t: "internal" | "external") => {
    setMode(t);
    setShowTypeModal(false);
  };

  const createDoc = async () => {
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
      .post(`/api/workspace/${workspace.groupId}/guides/create`, {
        name: form.getValues().name,
        content,
        roles: selectedRoles,
      })
      .catch((err) => {
        form.setError("name", {
          type: "custom",
          message: err?.response?.data?.error || "Failed to create",
        });
      });
    if (!session) return;
    form.clearErrors();
    if (mode === "external") {
      toast.success("Document created!");
      router.push(`/workspace/${workspace.groupId}/docs`);
    } else {
      toast.success("Document created!");
      router.push(
        `/workspace/${workspace.groupId}/docs/${session.data.document.id}`
      );
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

  const toggleRole = async (role: string) => {
    setSelectedRoles((prevRoles) => {
      if (prevRoles.includes(role)) {
        return prevRoles.filter((r) => r !== role);
      } else {
        return [...prevRoles, role];
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Toaster position="bottom-center" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 text-zinc-500 dark:text-zinc-300 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Go back"
          >
            <IconArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-medium text-zinc-900 dark:text-white">
              Documents
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-300">
              Create and manage your workspace documentation
            </p>
          </div>
        </div>
        <div
          className={`dark:bg-zinc-800 rounded-lg mb-6 transition-opacity duration-150 ${
            showTypeModal ? "opacity-40 pointer-events-none select-none" : ""
          }`}
        >
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
                    Access
                  </h2>
                  <h2 className="text-sm text-zinc-500 dark:text-zinc-300 mb-3">
                    Manage who can view this document
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
                    onClick={() => insertMarkdown("## ")}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                    aria-label="Heading 2"
                  >
                    <IconH2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => insertMarkdown("### ")}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                    aria-label="Heading 3"
                  >
                    <IconH3 className="w-4 h-4" />
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
                <h3 className="text-base font-medium text-zinc-900 dark:text-white mb-2">
                  External document
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300 mb-2">
                  This document points to an external URL — edit it here to
                  update the link.
                </p>
                <input
                  className="w-full p-2 border rounded text-zinc-600 dark:text-white border-gray-300 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-700"
                  placeholder="https://docs.planetaryapp.us/"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={goback}
                className="px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-white dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={form.handleSubmit(createDoc)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 transition-colors"
              >
                <IconCheck className="w-4 h-4" />
                Create Document
              </button>
            </div>
          </FormProvider>
        </div>
        {showTypeModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                Create a document
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Choose the document type
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => chooseType("internal")}
                  className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-700 dark:text-white text-left"
                >
                  Internal
                </button>
                <button
                  onClick={() => chooseType("external")}
                  className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-700 dark:text-white text-left"
                >
                  External (link)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

Home.layout = Workspace;

export default Home;
