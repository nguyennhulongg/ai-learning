"use client";

import { Button, Popover } from "antd";
import { AiOutlineUpload } from "react-icons/ai";
import { POPOVER_OPTIONS } from "@/constants/sidebar";

interface UploadButtonProps {
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onFileSelect: () => void;
}

export default function UploadButton({
  popoverOpen,
  onPopoverOpenChange,
  onFileSelect,
}: UploadButtonProps) {
  return (
    <Popover
      arrow={false}
      open={popoverOpen}
      onOpenChange={onPopoverOpenChange}
      content={
        <div style={{ width: "224px" }}>
          <Button
            block
            type="text"
            style={{ color: "var(--text-primary)", justifyContent: "flex-start" }}
            className="rounded-full"
            icon={<AiOutlineUpload size={14} />}
            onClick={onFileSelect}
          >
            {POPOVER_OPTIONS.upload}
          </Button>
        </div>
      }
      trigger="click"
      style={{ borderRadius: "100%" }}
      placement="topLeft"
    >
      <Button
        type="text"
        aria-label="Thêm"
        icon={
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        }
        style={{ color: "var(--text-muted)" }}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      />
    </Popover>
  );
}
