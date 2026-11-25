"use client";

import { useEffect, useRef, useState } from "react";
import { useDeleteSession, usePinSession, useUpdateSession } from "@/features/sessions/sessions.mutations";
import type { Conversation } from "@/types/chat";
import { Button, ConfigProvider, theme } from "antd";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { POPOVER_OPTIONS, SOCIAL_SHARE_URLS } from "@/constants/sidebar";
import ConversationItem from "./Sidebar/ConversationItem";
import ShareModal from "./Sidebar/ShareModal";
import DeleteModal from "./Sidebar/DeleteModal";
import RenameModal from "./Sidebar/RenameModal";
import DocumentUploadModal from "./Sidebar/DocumentUploadModal";
import SidebarHeader from "./Sidebar/SidebarHeader";
import SidebarFooter from "./Sidebar/SidebarFooter";
import SearchModal from "./Sidebar/SearchModal";
import { createStaticStyles } from "antd-style";
import { AiOutlineDown, AiOutlineUpload } from "react-icons/ai";

// Bề rộng thanh bên trên desktop (px).
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
// Bề rộng dải icon khi thu gọn.
const RAIL_WIDTH = 60;
// Kéo hẹp hơn mức này thì thu gọn thành dải icon (giống VS Code / Grok).
const COLLAPSE_THRESHOLD = 150;

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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  // Thu gọn thành dải icon hẹp. Chỉ áp dụng trên desktop; mobile dùng isOpen (trượt ra/vào).
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Bề rộng khi mở rộng (desktop), đổi được bằng cách kéo mép phải.
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  // Đang kéo thì tắt hiệu ứng chuyển động bề rộng, để thanh bên bám theo chuột ngay, không bị trễ.
  const [isResizing, setIsResizing] = useState(false);
  // Hàm gỡ các listener của lần kéo đang diễn ra; dùng khi component bị gỡ giữa lúc kéo.
  const stopResizeRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopResizeRef.current?.(), []);

  // Phím tắt Ctrl+K (⌘+K trên Mac) mở modal tìm kiếm ở bất kỳ đâu trên trang.
  // preventDefault: chặn hành vi mặc định của trình duyệt (Chrome dùng Ctrl+K để tìm trên thanh địa chỉ).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Desktop = rộng từ 1024px, trùng mốc lg: của Tailwind dùng trong className bên dưới.
  const isDesktop = useIsDesktop();
  const showRail = isDesktop && collapsed;

  // Bắt đầu kéo mép phải thanh bên.
  // Cách làm: ghi lại vị trí chuột và bề rộng lúc bấm; mỗi lần chuột di chuyển,
  // bề rộng mới = bề rộng ban đầu + quãng chuột đã đi theo chiều ngang.
  // Lắng nghe trên window (không phải trên mép) để chuột chạy ra ngoài mép vẫn kéo tiếp được.
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = showRail ? RAIL_WIDTH : width;
    setIsResizing(true);
    // Giữ con trỏ col-resize và chặn bôi đen chữ trong lúc kéo, kể cả khi chuột rời khỏi mép.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (ev: PointerEvent) => {
      const next = startWidth + (ev.clientX - startX);
      if (next < COLLAPSE_THRESHOLD) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
      }
    };

    const stop = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsResizing(false);
      stopResizeRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop);
    stopResizeRef.current = stop;
  };

  // Nút thu gọn/mở rộng: desktop thì đổi giữa đầy đủ ↔ dải icon; mobile thì đóng lớp trượt.
  const handleToggle = () => {
    if (isDesktop) setCollapsed((prev) => !prev);
    else onClose();
  };

  const deleteMutation = useDeleteSession();
  const updateMutation = useUpdateSession();
  const pinMutation = usePinSession();

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

        {/* Mobile: thanh bên nằm đè (fixed), trượt ra/vào bằng translate.
            Desktop: nằm cạnh khung chat (static), đổi bề rộng 256px ↔ 60px; transition-[width] làm hiệu ứng kéo ra/vào.
            overflow-hidden: trong lúc thu hẹp, phần chữ bị cắt gọn thay vì tràn ra ngoài. */}
        {/* Bề rộng: mobile cố định w-64; desktop lấy từ state (kéo được), thu gọn thì RAIL_WIDTH.
            lg:relative để mép kéo (absolute) bám vào cạnh phải của thanh bên. */}
        <aside
          style={{
            // Cùng màu nền với khung chat; ngăn cách bằng viền phải, màu --border dùng chung trong dự án.
            background: "var(--bg-base)",
            borderRight: "1px solid var(--border)",
            ...(isDesktop ? { width: showRail ? RAIL_WIDTH : width } : {}),
          }}
          className={`fixed lg:relative inset-y-0 left-0 z-30 flex flex-col shrink-0 overflow-hidden w-64
            ${isResizing ? "" : "transition-[width,transform] duration-200 ease-out"}
            ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          {/* Mép kéo: dải 6px trong suốt ở cạnh phải, rê chuột vào thì chỉ đổi con trỏ thành ↔.
              Chỉ có trên desktop; mobile thanh bên là lớp trượt nên không cần kéo. */}
          {isDesktop && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Kéo để đổi bề rộng thanh bên"
              onPointerDown={handleResizeStart}
              className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize"
            />
          )}
          <SidebarHeader
            collapsed={showRail}
            onToggle={handleToggle}
            onNewChat={onNew}
            onUpload={() => setUploadModalOpen(true)}
            onSearch={() => setSearchOpen(true)}
          />

          {/* Thu gọn thì KHÔNG render danh sách, chỉ để lại khoảng trống đẩy avatar xuống đáy.
              Không dùng class invisible (visibility: hidden): nút antd có sẵn transition: all 0.2s,
              nên visibility cũng bị "chuyển động" → nút còn hiện thêm 0.2s rồi mới mất, trông như nháy.
              Bề rộng cố định bằng bề rộng mở rộng: lúc thanh bên đang giãn ra (hiệu ứng), chữ không bị dồn dòng. */}
          {showRail ? (
            <div className="flex-1" />
          ) : (
          <div
            style={isDesktop ? { width } : undefined}
            className="flex-1 overflow-y-auto w-64"
          >
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
                    <Button
                      block
                      type="text"
                      style={{ color: "var(--text-primary)", justifyContent: "flex-start" }}
                      className="rounded-full"
                      icon={<AiOutlineUpload size={14} />}
                      onClick={() => setUploadModalOpen(true)}
                    >
                      {POPOVER_OPTIONS.upload}
                    </Button>
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
          )}

          <SidebarFooter collapsed={showRail} />
        </aside>

        <SearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          conversations={conversations}
          onSelectConversation={onSelect}
          onNewChat={onNew}
          onUpload={() => setUploadModalOpen(true)}
        />

        <DocumentUploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
        />

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
