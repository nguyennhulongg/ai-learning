"use client";

import { useState } from "react";
import type { Conversation } from "@/types/chat";
import { AiOutlineMore } from "react-icons/ai";
import { SlShare, SlPin, SlPencil, SlTrash } from "react-icons/sl";
import { Modal, Input, Button, Space, Popover, ConfigProvider, theme } from "antd";
import { LinkedinOutlined, FacebookOutlined, XOutlined, RedditOutlined } from "@ant-design/icons";

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
    const encodedUrl = encodeURIComponent(shareUrl);
    const urls = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}`,
      reddit: `https://www.reddit.com/submit?url=${encodedUrl}`,
    };
    window.open(urls[platform as keyof typeof urls], "_blank");
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
          {/* Logo */}
          <div className="h-14 flex items-center gap-2 px-4 shrink-0">
            <div
              style={{ background: "var(--bg-surface-user)" }}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
            >
              <svg
                style={{ color: "var(--text-primary)" }}
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z"
                />
              </svg>
            </div>
            <span style={{ color: "var(--text-primary)" }} className="font-semibold text-sm">
              AI Chat
            </span>
          </div>

          {/* New chat button */}
          <div className="px-3 pb-3 shrink-0">
            <Button
              onClick={onNew}
              type="text"
              style={{ color: "var(--text-primary)", width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px" }}
              className="hover:bg-white/5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Cuộc trò chuyện mới
            </Button>
          </div>

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
                  <li key={conv.id} className="relative group">
                    <div
                      onClick={() => onSelect(conv.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors cursor-pointer flex items-center justify-between
                        ${activeId === conv.id ? "font-medium" : "hover:bg-white/5"}`}
                      style={
                        activeId === conv.id
                          ? { background: "var(--bg-base)", color: "var(--text-primary)" }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      <span className="truncate">{conv.title}</span>
                      {conv.isPinned ? (
                        <div className="shrink-0 ml-2 relative">
                          <div
                            className="p-1 rounded-full hover:bg-white/10 cursor-pointer transition-opacity opacity-100 group-hover:opacity-0"
                            style={{ color: "var(--text-primary)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePin(conv.id);
                            }}
                          >
                            <SlPin size={14} />
                          </div>
                          <Popover
                            arrow={false}
                            open={popoverOpenId === conv.id}
                            onOpenChange={(open) => setPopoverOpenId(open ? conv.id : null)}
                            content={
                              <div
                                style={{ width: "224px" }}
                              >
                                <Button
                                  block
                                  type="text"
                                  style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
                                  className="rounded-full"
                                  icon={<SlShare size={14} />}
                                  onClick={() => handleShare(conv.id)}
                                >
                                  Chia sẻ
                                </Button>
                                <Button
                                  block
                                  type="text"
                                  style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
                                  className="rounded-full"
                                  icon={<SlPin size={14} />}
                                  onClick={() => handlePin(conv.id)}
                                >
                                  Bỏ ghim
                                </Button>
                                <Button
                                  block
                                  type="text"
                                  style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
                                  className="rounded-full"
                                  icon={<SlPencil size={14} />}
                                  onClick={() => handleRename(conv.id, conv.title)}
                                >
                                  Đổi tên
                                </Button>
                                <Button
                                  block
                                  type="text"
                                  style={{ color: "#ef4444", marginBottom: "8px", justifyContent: "flex-start" }}
                                  className="rounded-full"
                                  icon={<SlTrash size={14} />}
                                  onClick={() => handleDelete(conv.id)}
                                >
                                  Xóa
                                </Button>
                              </div>
                            }
                            trigger="click"
                            placement="rightTop"
                          >
                            <div
                              className="absolute top-0 left-0 p-1 rounded-full hover:bg-white/10 cursor-pointer transition-opacity opacity-0 group-hover:opacity-100"
                              style={{ color: "var(--text-muted)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AiOutlineMore size={16} />
                            </div>
                          </Popover>
                        </div>
                      ) : (
                        <Popover
                          arrow={false}
                          open={popoverOpenId === conv.id}
                          onOpenChange={(open) => setPopoverOpenId(open ? conv.id : null)}
                          content={
                            <div
                              style={{ width: "224px" }}
                            >
                              <Button
                                block
                                type="text"
                                style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
                                className="rounded-full"
                                icon={<SlShare size={14} />}
                                onClick={() => handleShare(conv.id)}
                              >
                                Chia sẻ
                              </Button>
                              <Button
                                block
                                type="text"
                                style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
                                className="rounded-full"
                                icon={<SlPin size={14} />}
                                onClick={() => handlePin(conv.id)}
                              >
                                Ghim
                              </Button>
                              <Button
                                block
                                type="text"
                                style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
                                className="rounded-full"
                                icon={<SlPencil size={14} />}
                                onClick={() => handleRename(conv.id, conv.title)}
                              >
                                Đổi tên
                              </Button>
                              <Button
                                block
                                type="text"
                                style={{ color: "#ef4444", marginBottom: "8px", justifyContent: "flex-start" }}
                                className="rounded-full"
                                icon={<SlTrash size={14} />}
                                onClick={() => handleDelete(conv.id)}
                              >
                                Xóa
                              </Button>
                            </div>
                          }
                          trigger="click"
                          placement="rightTop"
                        >
                          <div
                            className="shrink-0 ml-2 p-1 rounded-full hover:bg-white/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: "var(--text-muted)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <AiOutlineMore size={16} />
                          </div>
                        </Popover>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          {/* User footer */}
          <div className="p-3 shrink-0">
            <Button
              type="text"
              style={{ color: "var(--text-primary)", width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px" }}
              className="hover:bg-white/5"
            >
              <div
                style={{ background: "#715A5A", color: "#D3DAD9" }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              >
                U
              </div>
              <span className="truncate">Người dùng</span>
            </Button>
          </div>
        </aside>

        {/* Share Modal */}
        <Modal
          title="Đường liên kết công khai có thể chia sẻ"
          open={shareModalOpen}
          onCancel={() => setShareModalOpen(false)}
          footer={null}
          centered
        >
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Space.Compact style={{ width: "100%" }}>
                <Input value={shareUrl} readOnly style={{ flex: 1 }} />
                <Button type="link" onClick={handleCopyLink}>
                  Sao chép đường liên kết
                </Button>
              </Space.Compact>
            </div>
            <div style={{ color: "#9aa3a2", fontSize: "12px" }}>
              Bất kỳ ai có đường liên kết này đều có thể xem cuộc hội thoại này. Hãy chia sẻ đường liên kết một cách có trách nhiệm.
            </div>
            <div>
              <Space size="middle">
                <Button
                  icon={<LinkedinOutlined />}
                  onClick={() => handleSocialShare("linkedin")}
                />
                <Button
                  icon={<FacebookOutlined />}
                  onClick={() => handleSocialShare("facebook")}
                />
                <Button
                  icon={<XOutlined />}
                  onClick={() => handleSocialShare("twitter")}
                />
                <Button
                  icon={<RedditOutlined />}
                  onClick={() => handleSocialShare("reddit")}
                />
              </Space>
            </div>
          </Space>
        </Modal>

        {/* Delete Confirm Modal */}
        <Modal
          title="Bạn muốn xoá cuộc trò chuyện?"
          open={deleteModalOpen}
          onCancel={() => {
            setDeleteModalOpen(false);
            setSessionToDelete(null);
          }}
          footer={
            <div style={{ textAlign: "right", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button
                style={{ backgroundColor: "var(--bg-surface-ai)" }}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSessionToDelete(null);
                }}
              >
                Hủy
              </Button>
              <Button style={{ backgroundColor: "#3e3c46" }} onClick={confirmDelete}>
                Xóa
              </Button>
            </div>
          }
          centered
        >
          <p>
            Thao tác này sẽ xoá các câu lệnh, câu trả lời và ý kiến phản hồi khỏi Hoạt động của bạn trên Các ứng dụng Gemini, cũng như mọi nội dung bạn đã tạo.
          </p>
        </Modal>

        {/* Rename Modal */}
        <Modal
          title="Đổi tên cho cuộc trò chuyện này"
          open={renameModalOpen}
          onCancel={() => {
            setRenameModalOpen(false);
            setSessionToRename(null);
            setNewTitle("");
          }}
          closable={false}
          footer={
            <div style={{ textAlign: "right", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button
                style={{ backgroundColor: "var(--bg-surface-ai)" }}
                onClick={() => {
                  setRenameModalOpen(false);
                  setSessionToRename(null);
                  setNewTitle("");
                }}
              >
                Hủy
              </Button>
              <Button style={{ backgroundColor: "var(--bg-surface-ai)" }} onClick={confirmRename}>
                Đổi tên
              </Button>
            </div>
          }
          centered
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nhập tên mới..."
            style={{ color: "var(--text-primary)" }}
          />
        </Modal>
      </ConfigProvider>
    </>
  );
}
