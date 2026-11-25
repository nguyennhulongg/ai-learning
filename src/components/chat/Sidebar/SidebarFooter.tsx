import { Button } from "antd";

interface SidebarFooterProps {
  // Thanh bên thu gọn: chỉ còn avatar, ẩn tên.
  collapsed?: boolean;
}

// Phần chân thanh bên: avatar và tên người dùng.
export default function SidebarFooter({ collapsed = false }: SidebarFooterProps) {
  return (
    <div className={`shrink-0 ${collapsed ? "py-3 flex justify-center" : "p-3"}`}>
      <Button
        type="text"
        style={{ color: "var(--text-primary)", width: collapsed ? "auto" : "100%", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px" }}
        className="hover:bg-white/5"
      >
        <div
          style={{ background: "#715A5A", color: "#D3DAD9" }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
        >
          U
        </div>
        {!collapsed && <span className="truncate">Người dùng</span>}
      </Button>
    </div>
  );
}
