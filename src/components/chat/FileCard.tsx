"use client";

import { AiOutlineClose } from "react-icons/ai";
import { getFileIcon } from "@/constants/fileIcons";
import { UploadedFile } from "./ChatInput";

interface FileCardProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
}

export default function FileCard({ file, onRemove }: FileCardProps) {
  return (
    <div
      style={{ background: "var(--bg-base)", width: "112px", height: "112px" }}
      className="flex flex-col justify-between rounded-[20px] px-4 py-4 shrink-0 relative group"
    >
      {file.isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent border-gray-400 animate-spin"
            style={{ borderTopColor: "var(--text-muted)" }}
          />
        </div>
      ) : (
        <>
          <div
            className="w-6 h-6 rounded flex items-center justify-center shrink-0 self-start"
          >
            <span className="text-xl">{getFileIcon(file.name)}</span>
          </div>
          <span
            style={{ color: "var(--text-primary)" }}
            className="text-sm truncate text-center"
          >
            {file.name.length > 12
              ? file.name.slice(0, 12) + "..."
              : file.name}
          </span>
        </>
      )}
      <button
        onClick={() => onRemove(file.id)}
        style={{ color: "var(--text-muted)" }}
        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none outline-none cursor-pointer"
      >
        <AiOutlineClose size={14} />
      </button>
    </div>
  );
}
