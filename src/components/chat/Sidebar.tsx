"use client";

import { useState } from "react";
import { useUploadFile } from "@/features/upload/upload.mutations";
import { useDeleteSession, usePinSession, useUpdateSession } from "@/features/sessions/sessions.mutations";
import type { Conversation } from "@/types/chat";
import { Button, ConfigProvider, message, notification, theme, Upload, UploadProps } from "antd";
import { POPOVER_OPTIONS, SOCIAL_SHARE_URLS } from "@/constants/sidebar";
import ConversationItem from "./Sidebar/ConversationItem";
import ShareModal from "./Sidebar/ShareModal";
import DeleteModal from "./Sidebar/DeleteModal";
import RenameModal from "./Sidebar/RenameModal";
import SidebarHeader from "./Sidebar/SidebarHeader";
import SidebarFooter from "./Sidebar/SidebarFooter";
import { createStaticStyles } from "antd-style";
import { AiOutlineDown, AiOutlineUpload } from "react-icons/ai";
import { UPLOAD_PURPOSE } from "@/constants/files";
import { useOcrProcess } from "@/features/ocr-process/ocr-process.mutations";

type NotificationType = 'success' | 'info' | 'warning' | 'error';
interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  onPin?: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}


const titleButtonClassNames = createStaticStyles(({ css }) => ({
  content: css`
   color: rgb(133, 133, 133);
   font-size: 14px;
   font-weight: 500;
  `,
  root: css`
    width: fit-content;
    display: flex;
    align-items: center;
    height: fit-content;
    gap: 3px;
    margin-top: 4px;
    margin-bottom: 4px;
  `,
}));

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onPin,
  isOpen,
  onClose,
}: SidebarProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [popoverOpenId, setPopoverOpenId] = useState<string | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [documentSectionOpen, setDocumentSectionOpen] = useState(true);
  const [chatsSectionOpen, setChatsSectionOpen] = useState(true);
  const [api, contextHolder] = notification.useNotification();

  const openNotificationWithIcon = (type: NotificationType) => {
    api[type]({
      title: 'Document uploaded successfully!',
    });
  };

  const uploadMutation = useUploadFile();
  const deleteMutation = useDeleteSession();
  const updateMutation = useUpdateSession();
  const pinMutation = usePinSession();
  const ocrProcessMutation = useOcrProcess()

  const props: UploadProps = {
    name: 'file',
    action: '/api/upload',
    customRequest: async (options) => {
      const { onSuccess, onError, file } = options;
      try {
        const formData = new FormData();
        formData.append('file', file as any);
        formData.append('purpose', UPLOAD_PURPOSE.KNOWLEDGE_BASE);

        const data = await uploadMutation.mutateAsync(formData);
        onSuccess?.(data);
        openNotificationWithIcon('success');

        await ocrProcessMutation.mutateAsync(data.fileId);
      } catch (error) {
        onError?.(error as Error);
        openNotificationWithIcon('error');
      }
    },
    showUploadList: false,
  };

  const handleDelete = async (id: string) => {
    setSessionToDelete(id);
    setDeleteModalOpen(true);
    setPopoverOpenId(null);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;
    deleteMutation.mutate(sessionToDelete);
    onDelete?.(sessionToDelete);
    setDeleteModalOpen(false);
    setSessionToDelete(null);
  };

  const handleRename = (id: string, currentTitle: string) => {
    setSessionToRename(id);
    setNewTitle(currentTitle);
    setRenameModalOpen(true);
    setPopoverOpenId(null);
  };

  const confirmRename = async () => {
    if (!sessionToRename || !newTitle.trim()) return;
    updateMutation.mutate({ id: sessionToRename, payload: { title: newTitle.trim() } });
    onRename?.(sessionToRename, newTitle.trim());
    setRenameModalOpen(false);
    setSessionToRename(null);
    setNewTitle("");
  };

  const handlePin = async (id: string) => {
    const session = conversations.find(c => c.id === id);
    if (!session) return;
    pinMutation.mutate({ id, isPinned: !session.isPinned });
    onPin?.(id);
    setPopoverOpenId(null);
  };

  const handleShare = (id: string) => {
    const url = `${window.location.origin}?session=${id}`;
    setShareUrl(url);
    setShareModalOpen(true);
    setPopoverOpenId(null);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  const handleSocialShare = (platform: string) => {
    const url = SOCIAL_SHARE_URLS[platform as keyof typeof SOCIAL_SHARE_URLS](shareUrl);
    window.open(url, "_blank");
  };
  return (
    <>
      {contextHolder}
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorBgElevated: "var(--bg-surface-ai)",
            colorText: "var(--text-primary)",
            colorBgContainer: "var(--bg-surface-ai)",
          },
        }}
      >
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={onClose}
          />
        )}

        <aside
          style={{ background: "var(--bg-sidebar)" }}
          className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col
            transition-transform duration-200
            ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          <SidebarHeader onNewChat={onNew} />

          <div className="flex-1 overflow-y-auto">
            <Button
              classNames={titleButtonClassNames}
              type="link"
              onClick={() => setDocumentSectionOpen(!documentSectionOpen)}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={(e) => {
                const icon = e.currentTarget.querySelector('.toggle-icon') as HTMLElement;
                if (icon) icon.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                const icon = e.currentTarget.querySelector('.toggle-icon') as HTMLElement;
                if (icon) icon.style.opacity = '0';
              }}
            >
              <span>Document</span>
              <span className="toggle-icon" style={{ opacity: 0, transition: "opacity 0.2s, transform 0.3s", transform: documentSectionOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>
                <AiOutlineDown size={12} />
              </span>
            </Button>
            {documentSectionOpen && (
              <nav className="px-2">
                <ul>
                  <li>
                    <Upload {...props} style={{ width: "100%" }}>
                      <Button
                        block
                        type="text"
                        style={{ color: "var(--text-primary)", justifyContent: "flex-start" }}
                        className="rounded-full"
                        icon={<AiOutlineUpload size={14} />}
                      >
                        {POPOVER_OPTIONS.upload}
                      </Button>
                    </Upload>
                  </li>
                </ul>
              </nav>
            )}


            {/* Conversation list */}

            <Button
              classNames={titleButtonClassNames}
              type="link"
              onClick={() => setChatsSectionOpen(!chatsSectionOpen)}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={(e) => {
                const icon = e.currentTarget.querySelector('.toggle-icon') as HTMLElement;
                if (icon) icon.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                const icon = e.currentTarget.querySelector('.toggle-icon') as HTMLElement;
                if (icon) icon.style.opacity = '0';
              }}
            >
              <span>Chats</span>
              <span className="toggle-icon" style={{ opacity: 0, transition: "opacity 0.2s, transform 0.3s", transform: chatsSectionOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>
                <AiOutlineDown size={12} />
              </span>
            </Button>
            {chatsSectionOpen && (
              <nav className="px-2 pb-4">
                {conversations.length === 0 ? (
                  <p
                    style={{ color: "var(--text-muted)" }}
                    className="text-xs text-center mt-6 px-4"
                  >
                    Chưa có cuộc trò chuyện nào
                  </p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {conversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conv={conv}
                        isActive={activeId === conv.id}
                        popoverOpenId={popoverOpenId}
                        onPin={handlePin}
                        onShare={handleShare}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        onSelect={onSelect}
                        onPopoverOpenChange={(open, id) => setPopoverOpenId(open ? id : null)}
                      />
                    ))}
                  </ul>
                )}
              </nav>
            )}
          </div>

          <Button onClick={async () => {
            const formData = new FormData();

            formData.append("files", new File([], "src/constants/page_72.pdf"));
            formData.append("to_formats", "json");
            formData.append("do_ocr", "true");

            const response = await fetch(
              "http://127.0.0.1:5001/v1/convert/file",
              {
                method: "POST",
                body: formData,
              },
            );

            if (!response.ok) {
              throw new Error(
                `Docling failed: ${response.status} ${await response.text()}`,
              );
            }

            return response.json();
          }}>
            Button
          </Button>

          <SidebarFooter />
        </aside>

        <ShareModal
          open={shareModalOpen}
          shareUrl={shareUrl}
          onClose={() => setShareModalOpen(false)}
          onCopyLink={handleCopyLink}
          onSocialShare={handleSocialShare}
        />

        <DeleteModal
          open={deleteModalOpen}
          onCancel={() => {
            setDeleteModalOpen(false);
            setSessionToDelete(null);
          }}
          onConfirm={confirmDelete}
        />

        <RenameModal
          open={renameModalOpen}
          newTitle={newTitle}
          onTitleChange={setNewTitle}
          onCancel={() => {
            setRenameModalOpen(false);
            setSessionToRename(null);
            setNewTitle("");
          }}
          onConfirm={confirmRename}
        />
      </ConfigProvider>
    </>
  );
}
