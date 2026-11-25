"use client";

import { useMemo, useRef, useState } from "react";
import { Input, Modal, type InputRef } from "antd";
import { AiOutlinePlus, AiOutlineUpload } from "react-icons/ai";
import { LuMessageCircle, LuSearch } from "react-icons/lu";
import type { Conversation } from "@/types/chat";
import { POPOVER_OPTIONS } from "@/constants/sidebar";
import { foldText } from "@/utils/fold-text";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onUpload: () => void;
}

// Một dòng trong danh sách kết quả: thao tác nhanh hoặc một cuộc trò chuyện.
// Gộp chung một mảng để phím ↑↓ đi xuyên qua cả hai nhóm như một danh sách liền.
type SearchItem = {
  key: string;
  group: "actions" | "chats";
  icon: React.ReactNode;
  label: string;
  meta?: string;
  run: () => void;
};

const MAX_CHAT_RESULTS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// Mô tả thời điểm tạo cuộc trò chuyện cho gọn: "Hôm nay", "Hôm qua", "3 ngày trước", "2 tuần trước",
// xa hơn 4 tuần thì ghi ngày/tháng (thêm năm nếu khác năm hiện tại).
function formatRelativeDate(date: Date, now = new Date()): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfToday - startOfDate) / DAY_MS);

  if (days <= 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  if (days < 28) return `${Math.floor(days / 7)} tuần trước`;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

// Modal tìm kiếm kiểu "command palette" (bảng lệnh): gõ để lọc, ↑↓ để chọn, Enter để mở, Esc để đóng.
// Tìm theo tiêu đề cuộc trò chuyện, so ở dạng bỏ dấu nên gõ "phai thu" vẫn ra "phải thu".
export default function SearchModal({
  open,
  onClose,
  conversations,
  onSelectConversation,
  onNewChat,
  onUpload,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  // Dòng đang được chọn. -1 = chưa chọn dòng nào (lúc vừa mở), nên không dòng nào có nền.
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<InputRef>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Tính lại danh sách mỗi khi từ khoá hoặc danh sách cuộc trò chuyện đổi.
  const items = useMemo<SearchItem[]>(() => {
    const folded = foldText(query);
    const matches = (text: string) => !folded || foldText(text).includes(folded);

    // Đóng modal trước rồi mới chạy thao tác, để modal không che màn hình tiếp theo.
    const closeThen = (fn: () => void) => () => {
      onClose();
      fn();
    };

    const actions: SearchItem[] = [
      {
        key: "action:new-chat",
        group: "actions" as const,
        icon: <AiOutlinePlus size={16} />,
        label: "Cuộc trò chuyện mới",
        run: closeThen(onNewChat),
      },
      {
        key: "action:upload",
        group: "actions" as const,
        icon: <AiOutlineUpload size={16} />,
        label: POPOVER_OPTIONS.upload,
        run: closeThen(onUpload),
      },
    ].filter((item) => matches(item.label));

    const chats: SearchItem[] = conversations
      .filter((conv) => matches(conv.title))
      .slice(0, MAX_CHAT_RESULTS)
      .map((conv) => ({
        key: `chat:${conv.id}`,
        group: "chats" as const,
        icon: <LuMessageCircle size={16} />,
        label: conv.title,
        meta: formatRelativeDate(conv.createdAt),
        run: closeThen(() => onSelectConversation(conv.id)),
      }));

    return [...actions, ...chats];
  }, [query, conversations, onClose, onNewChat, onUpload, onSelectConversation]);

  // Gõ từ khoá mới thì bỏ chọn, vì danh sách đã đổi.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
  };

  // Chọn dòng thứ index và cuộn danh sách để dòng đó luôn nằm trong vùng nhìn thấy.
  const moveTo = (index: number) => {
    setActiveIndex(index);
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  // Phím trong ô tìm kiếm. Esc do Modal tự xử lý (đóng modal).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveTo((activeIndex + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      // Đang chưa chọn (-1) mà bấm ↑ thì nhảy xuống dòng cuối.
      moveTo(activeIndex <= 0 ? items.length - 1 : activeIndex - 1);
    } else if (e.key === "Enter") {
      // Chưa chọn dòng nào mà đã gõ từ khoá → mở kết quả đầu tiên, cho nhanh.
      e.preventDefault();
      const index = activeIndex === -1 && query.trim() ? 0 : activeIndex;
      items[index]?.run();
    }
  };

  // Vẽ một nhóm (tiêu đề nhóm + các dòng). index của dòng là vị trí trong mảng items chung.
  const renderGroup = (group: SearchItem["group"], title?: string) => {
    const groupItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.group === group);
    if (groupItems.length === 0) return null;

    return (
      <div className="flex flex-col gap-0.5">
        {title && (
          <div className="px-3 pt-3 pb-1 text-[13px] font-medium" style={{ color: "rgb(133, 133, 133)" }}>
            {title}
          </div>
        )}
        {groupItems.map(({ item, index }) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={item.key}
              data-index={index}
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={item.run}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm"
              style={{
                color: "var(--text-primary)",
                background: isActive ? "rgba(252, 252, 252, 0.08)" : "transparent",
              }}
            >
              <span className="shrink-0 opacity-80 flex">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.meta && <span className="shrink-0 text-xs opacity-50">{item.meta}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={720}
      style={{ top: "15vh" }}
      // Mở xong thì đặt con trỏ vào ô tìm kiếm; đóng xong thì xoá từ khoá cho lần mở sau.
      afterOpenChange={(isOpen) => {
        if (isOpen) {
          inputRef.current?.focus();
        } else {
          setQuery("");
          setActiveIndex(-1);
        }
      }}
      styles={{
        container: {
          // Cùng màu nền với thanh bên (và khung chat).
          background: "var(--bg-base)",
          padding: 8,
          borderRadius: 24,
          border: "1px solid rgba(252, 252, 252, 0.08)",
        },
      }}
    >
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tìm cuộc trò chuyện hoặc thao tác"
        prefix={<LuSearch size={16} className="opacity-60 mr-1" />}
        variant="borderless"
        // Class riêng để globals.css ép nền trong suốt cho cả thẻ bọc lẫn thẻ input bên trong.
        className="search-modal-input"
        style={{ fontSize: 15, padding: "10px 12px", color: "var(--text-primary)" }}
      />

      <div ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto mt-1 flex flex-col">
        {renderGroup("actions")}
        {renderGroup("chats", "Cuộc trò chuyện")}
        {items.length === 0 && (
          <div className="px-3 py-6 text-center text-sm opacity-60">
            Không tìm thấy kết quả cho “{query}”
          </div>
        )}
      </div>
    </Modal>
  );
}
