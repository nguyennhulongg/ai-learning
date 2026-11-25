"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Tooltip } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { BsCheck2, BsCopy, BsPencil } from "react-icons/bs";

type MessageActionsProps = {
  // Nội dung sẽ được chép khi bấm nút Sao chép.
  text: string;
  // "start" = canh trái (tin AI), "end" = canh phải (tin người dùng).
  align: "start" | "end";
  // false khi AI đang trả lời: sửa/thử lại lúc này sẽ chen ngang request đang chạy.
  canAct: boolean;
  // true = luôn hiện; false = chỉ hiện khi rê chuột vào tin nhắn (class "group" ở thẻ cha).
  alwaysVisible?: boolean;
  // Không truyền = ẩn nút tương ứng.
  onEdit?: () => void;
  onRetry?: () => void;
};

const COPIED_RESET_MS = 1500;

// Hàng nút nhỏ ngay dưới một tin nhắn: Sao chép, và tùy loại tin là Sửa (người dùng) hoặc Thử lại (AI).
export default function MessageActions({
  text,
  align,
  canAct,
  alwaysVisible = false,
  onEdit,
  onRetry,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dọn timer khi component bị gỡ, tránh setState trên component đã unmount.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Chép nội dung vào clipboard, đổi icon thành dấu tích trong 1.5 giây để báo đã chép.
  // clipboard API chỉ chạy trên https hoặc localhost, nên bọc try/catch.
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  // opacity-0 vẫn giữ chỗ cho hàng nút, nên tin nhắn không bị nhảy khi nút hiện ra.
  // focus-within: dùng phím Tab tới nút thì hàng nút cũng hiện.
  const visibility = alwaysVisible
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 focus-within:opacity-100";

  return (
    <div
      className={`flex items-center gap-0.5 transition-opacity duration-150 ${visibility} ${
        align === "end" ? "justify-end" : "justify-start"
      }`}
    >
      <Tooltip title={copied ? "Đã sao chép" : "Sao chép"}>
        <Button
          type="text"
          size="small"
          aria-label="Sao chép tin nhắn"
          icon={copied ? <BsCheck2 /> : <BsCopy />}
          onClick={handleCopy}
          style={{ opacity: 0.7 }}
        />
      </Tooltip>
      {onEdit && (
        <Tooltip title="Sửa">
          <Button
            type="text"
            size="small"
            aria-label="Sửa tin nhắn"
            icon={<BsPencil />}
            disabled={!canAct}
            onClick={onEdit}
            style={{ opacity: canAct ? 0.7 : 0.3 }}
          />
        </Tooltip>
      )}
      {onRetry && (
        <Tooltip title="Thử lại">
          <Button
            type="text"
            size="small"
            aria-label="Tạo lại câu trả lời"
            icon={<ReloadOutlined />}
            disabled={!canAct}
            onClick={onRetry}
            style={{ opacity: canAct ? 0.7 : 0.3 }}
          />
        </Tooltip>
      )}
    </div>
  );
}
