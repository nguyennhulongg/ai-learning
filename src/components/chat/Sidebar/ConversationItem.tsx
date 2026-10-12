import { AiOutlineMore } from "react-icons/ai";
import { SlShare, SlPin, SlPencil, SlTrash } from "react-icons/sl";
import { Button, Popover } from "antd";
import type { Conversation } from "@/types/chat";
import { POPOVER_OPTIONS } from "@/constants/sidebar";

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  popoverOpenId: string | null;
  onPin: (id: string) => void;
  onShare: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onPopoverOpenChange: (open: boolean, id: string) => void;
}

export default function ConversationItem({
  conv,
  isActive,
  popoverOpenId,
  onPin,
  onShare,
  onRename,
  onDelete,
  onSelect,
  onPopoverOpenChange,
}: ConversationItemProps) {
  const isPinned = conv.isPinned || false;
  const isPopoverOpen = popoverOpenId === conv.id;

  return (
    <li className="relative group">
      <div
        onClick={() => onSelect(conv.id)}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors cursor-pointer flex items-center justify-between
          ${isActive ? "font-medium" : "hover:bg-white/5"}`}
        style={
          isActive
            ? { background: "var(--bg-base)", color: "var(--text-primary)" }
            : { color: "var(--text-muted)" }
        }
      >
        <span className="truncate">{conv.title}</span>
        {isPinned ? (
          <div className="shrink-0 ml-2 relative">
            <div
              className="p-1 rounded-full hover:bg-white/10 cursor-pointer transition-opacity opacity-100 group-hover:opacity-0"
              style={{ color: "var(--text-primary)" }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onPin(conv.id);
              }}
            >
              <SlPin size={14} />
            </div>
            <Popover
              arrow={false}
              open={isPopoverOpen}
              onOpenChange={(open) => onPopoverOpenChange(open, conv.id)}
              content={
                <PopoverContent
                  isPinned={isPinned}
                  onShare={() => onShare(conv.id)}
                  onPin={() => onPin(conv.id)}
                  onRename={() => onRename(conv.id, conv.title)}
                  onDelete={() => onDelete(conv.id)}
                />
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
            open={isPopoverOpen}
            onOpenChange={(open) => onPopoverOpenChange(open, conv.id)}
            content={
              <PopoverContent
                isPinned={isPinned}
                onShare={() => onShare(conv.id)}
                onPin={() => onPin(conv.id)}
                onRename={() => onRename(conv.id, conv.title)}
                onDelete={() => onDelete(conv.id)}
              />
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
  );
}

function PopoverContent({
  isPinned,
  onShare,
  onPin,
  onRename,
  onDelete,
}: {
  isPinned: boolean;
  onShare: () => void;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ width: "224px" }}>
      <Button
        block
        type="text"
        style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
        className="rounded-full"
        icon={<SlShare size={14} />}
        onClick={onShare}
      >
        {POPOVER_OPTIONS.share}
      </Button>
      <Button
        block
        type="text"
        style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
        className="rounded-full"
        icon={<SlPin size={14} />}
        onClick={onPin}
      >
        {isPinned ? POPOVER_OPTIONS.unpin : POPOVER_OPTIONS.pin}
      </Button>
      <Button
        block
        type="text"
        style={{ color: "var(--text-primary)", marginBottom: "8px", justifyContent: "flex-start" }}
        className="rounded-full"
        icon={<SlPencil size={14} />}
        onClick={onRename}
      >
        {POPOVER_OPTIONS.rename}
      </Button>
      <Button
        block
        type="text"
        style={{ color: "#ef4444", marginBottom: "8px", justifyContent: "flex-start" }}
        className="rounded-full"
        icon={<SlTrash size={14} />}
        onClick={onDelete}
      >
        {POPOVER_OPTIONS.delete}
      </Button>
    </div>
  );
}
