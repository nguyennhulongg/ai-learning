import { Modal, Button } from "antd";
import { MODAL_TEXTS } from "@/constants/sidebar";

interface DeleteModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteModal({ open, onCancel, onConfirm }: DeleteModalProps) {
  return (
    <Modal
      title={MODAL_TEXTS.delete.title}
      open={open}
      onCancel={onCancel}
      footer={
        <div style={{ textAlign: "right", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <Button
            style={{ backgroundColor: "var(--bg-surface-ai)" }}
            onClick={onCancel}
          >
            {MODAL_TEXTS.delete.cancelButton}
          </Button>
          <Button style={{ backgroundColor: "#3e3c46" }} onClick={onConfirm}>
            {MODAL_TEXTS.delete.confirmButton}
          </Button>
        </div>
      }
      centered
    >
      <p>{MODAL_TEXTS.delete.content}</p>
    </Modal>
  );
}
