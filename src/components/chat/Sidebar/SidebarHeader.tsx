import { Button, Tooltip } from "antd";
import { AiOutlinePlus, AiOutlineUpload } from "react-icons/ai";
import { LuPanelLeft, LuSearch } from "react-icons/lu";
import { POPOVER_OPTIONS } from "@/constants/sidebar";

interface SidebarHeaderProps {
  // true = thanh bên đang thu gọn thành dải icon (chỉ có trên desktop).
  collapsed: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  // Chỉ dùng ở dạng thu gọn: dải icon có thêm nút Tải tệp lên (dạng mở rộng đã có trong mục Document).
  onUpload: () => void;
  // Mở modal tìm kiếm cuộc trò chuyện.
  onSearch: () => void;
}

const NEW_CHAT_LABEL = "Cuộc trò chuyện mới";

// Nút vuông chỉ có icon, dùng cho nút thu gọn/mở rộng và các nút ở dải icon khi thu gọn.
// Tooltip hiện tên nút khi rê chuột; aria-label dành cho trình đọc màn hình.
// tooltipPlacement: hướng hiện tooltip. Dải icon (thu gọn) hiện sang phải; ở dạng mở rộng,
// hai nút góc trên hiện xuống dưới, vì hiện sang ngang sẽ bị che.
function IconButton({
  label,
  icon,
  onClick,
  tooltipPlacement = "right",
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tooltipPlacement?: "right" | "bottom";
}) {
  return (
    // arrow={false}: bỏ mũi tên. antd chừa sẵn khoảng cho mũi tên, mà mũi tên lại không hiện trên nền tối,
    // nên tooltip trông cách xa icon. align.offset: dịch tooltip, ở đây chỉ cách icon 4px.
    <Tooltip
      title={label}
      placement={tooltipPlacement}
      arrow={false}
      align={{ offset: tooltipPlacement === "bottom" ? [0, 4] : [4, 0] }}
    >
      <Button
        type="text"
        aria-label={label}
        icon={icon}
        onClick={onClick}
        style={{ width: 36, height: 36, borderRadius: 10 }}
        className="hover:bg-white/5"
      />
    </Tooltip>
  );
}

// Phần đầu thanh bên: nút thu gọn/mở rộng (giống Grok) và nút tạo cuộc trò chuyện mới.
export default function SidebarHeader({
  collapsed,
  onToggle,
  onNewChat,
  onUpload,
  onSearch,
}: SidebarHeaderProps) {
  const tooltipPlacement = collapsed ? "right" : "bottom";

  const toggle = (
    <IconButton
      label={collapsed ? "Mở thanh bên" : "Thu gọn thanh bên"}
      icon={<LuPanelLeft size={18} />}
      onClick={onToggle}
      tooltipPlacement={tooltipPlacement}
    />
  );

  const search = (
    <IconButton
      label="Tìm kiếm (Ctrl+K)"
      icon={<LuSearch size={17} />}
      onClick={onSearch}
      tooltipPlacement={tooltipPlacement}
    />
  );

  // Dạng thu gọn: một cột icon canh giữa.
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 pt-3 shrink-0">
        {toggle}
        {search}
        <IconButton label={NEW_CHAT_LABEL} icon={<AiOutlinePlus size={16} />} onClick={onNewChat} />
        <IconButton
          label={POPOVER_OPTIONS.upload}
          icon={<AiOutlineUpload size={16} />}
          onClick={onUpload}
        />
      </div>
    );
  }

  return (
    <>
      {/* Giống Grok: nút thu gọn và nút tìm kiếm nằm cạnh nhau ở góc trên. */}
      <div className="h-14 flex items-center gap-1 px-3 shrink-0">
        {toggle}
        {search}
      </div>

      <div className="px-3 pb-3 shrink-0">
        <Button
          onClick={onNewChat}
          type="text"
          icon={<AiOutlinePlus size={16} />}
          style={{ color: "var(--text-primary)", width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px" }}
          className="hover:bg-white/5"
        >
          {NEW_CHAT_LABEL}
        </Button>
      </div>
    </>
  );
}
