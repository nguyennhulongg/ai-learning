import { Button } from "antd";

export default function SidebarFooter() {
  return (
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
  );
}
