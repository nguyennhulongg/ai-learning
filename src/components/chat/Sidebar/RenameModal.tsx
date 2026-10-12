import { Modal, Input, Button } from "antd";
import { MODAL_TEXTS } from "@/constants/sidebar";

interface RenameModalProps {
  open: boolean;
  newTitle: string;
  onTitleChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function RenameModal({
  open,
  newTitle,
  onTitleChange,
  onCancel,
  onConfirm,
}: RenameModalProps) {
  return (
    <Modal
      title={MODAL_TEXTS.rename.title}
      open={open}
      onCancel={onCancel}
      closable={false}
      footer={
        <div style={{ textAlign: "right", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <Button
            style={{ backgroundColor: "var(--bg-surface-ai)" }}
            onClick={onCancel}
          >
            {MODAL_TEXTS.rename.cancelButton}
          </Button>
          <Button style={{ backgroundColor: "var(--bg-surface-ai)" }} onClick={onConfirm}>
            {MODAL_TEXTS.rename.confirmButton}
          </Button>
        </div>
      }
      centered
    >
      <Input
        value={newTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={MODAL_TEXTS.rename.placeholder}
        style={{ color: "var(--text-primary)" }}
      />
    </Modal>
  );
}
