"use client";

import { useState } from "react";
import type { Conversation } from "@/types/chat";
import { ConfigProvider, theme } from "antd";
import { SOCIAL_SHARE_URLS } from "@/constants/sidebar";
import ConversationItem from "./Sidebar/ConversationItem";
import ShareModal from "./Sidebar/ShareModal";
import DeleteModal from "./Sidebar/DeleteModal";
import RenameModal from "./Sidebar/RenameModal";
import SidebarHeader from "./Sidebar/SidebarHeader";
import SidebarFooter from "./Sidebar/SidebarFooter";

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
  const {
    token: { colorBgElevated, colorText },
  } = theme.useToken();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [popoverOpenId, setPopoverOpenId] = useState<string | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const handleDelete = async (id: string) => {
    setSessionToDelete(id);
    setDeleteModalOpen(true);
    setPopoverOpenId(null);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      await fetch(`/api/sessions/${sessionToDelete}/delete`, { method: "DELETE" });
      onDelete?.(sessionToDelete);
      setDeleteModalOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const handleRename = (id: string, currentTitle: string) => {
    setSessionToRename(id);
    setNewTitle(currentTitle);
    setRenameModalOpen(true);
    setPopoverOpenId(null);
  };

  const confirmRename = async () => {
    if (!sessionToRename || !newTitle.trim()) return;

    try {
      await fetch(`/api/sessions/${sessionToRename}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      onRename?.(sessionToRename, newTitle.trim());
      setRenameModalOpen(false);
      setSessionToRename(null);
      setNewTitle("");
    } catch (error) {
      console.error("Failed to rename session:", error);
    }
  };

  const handlePin = async (id: string) => {
    const session = conversations.find(c => c.id === id);
    if (!session) return;

    try {
      await fetch(`/api/sessions/${id}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !session.isPinned }),
      });
      onPin?.(id);
      setPopoverOpenId(null);
    } catch (error) {
      console.error("Failed to pin session:", error);
    }
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

          {/* Conversation list */}
          <nav className="flex-1 overflow-y-auto px-2 pb-4">
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
