"use client";

import { Button, ConfigProvider, Empty, Flex, Modal, Progress, Tabs, theme, Tooltip, Typography, Upload } from "antd";
import type { ReactNode } from "react";
import { AiOutlineDelete, AiOutlineInbox, AiOutlineReload, AiOutlineStop } from "react-icons/ai";

import { getFileIcon } from "@/constants/fileIcons";
import { PREPARING_PROGRESS, WAITING_PROGRESS, type DocumentProgress } from "@/constants/progress";
import {
  getDocumentGroup,
  getFailureReason,
  type DocumentRecord,
} from "@/features/upload/documents";
import { useDocumentQueue } from "@/features/upload/useDocumentQueue";

// Giao diện nền tối nên dùng thuật toán màu tối của antd. Thuật toán này tự chọn đúng màu
// cho chữ phụ, nền thanh tiến độ và đường kẻ, còn các màu chính lấy từ biến CSS của app.
const MODAL_THEME = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorBgElevated: "var(--bg-surface-ai)",
    colorBgContainer: "var(--bg-surface-ai)",
    colorText: "var(--text-primary)",
  },
};

const MODAL_WIDTH = 640;

const CONTENT_ONLY_DESCRIPTION = "Đã lưu nội dung, không có bảng báo cáo chính";

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
}

interface FileRowProps {
  name: string;
  description: string;
  progress?: DocumentProgress;
  actions?: ReactNode;
}

interface IconActionProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

// Nút chỉ có icon. Tooltip giải thích khi rê chuột, aria-label dành cho trình đọc màn hình.
function IconAction({ label, icon, onClick }: IconActionProps) {
  return (
    <Tooltip title={label}>
      <Button type="text" size="small" aria-label={label} icon={icon} onClick={onClick} />
    </Tooltip>
  );
}

// Một dòng tài liệu: icon, tên file và các nút ở trên, thanh tiến độ hoặc mô tả ở dưới.
function FileRow({ name, description, progress, actions }: FileRowProps) {
  return (
    <Flex vertical gap={2} style={{ padding: "8px 0" }}>
      <Flex align="center" justify="space-between" gap={8}>
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          <span>{getFileIcon(name)}</span>
          <Typography.Text ellipsis={{ tooltip: name }}>{name}</Typography.Text>
        </Flex>
        {actions && <Flex gap={4}>{actions}</Flex>}
      </Flex>
      {progress && (
        <Progress
          percent={progress.percent}
          status={progress === WAITING_PROGRESS ? "normal" : "active"}
          size="small"
          showInfo={false}
        />
      )}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {description}
      </Typography.Text>
    </Flex>
  );
}

// Mô tả kết quả của tài liệu đã xử lý thành công.
function describeSuccess(document: DocumentRecord): string {
  const extraction = document.metadata.extraction;
  const report = extraction?.report;
  if (!extraction || !report) return "";

  const period = report.fiscal_quarter === 0 ? "cả năm" : `quý ${report.fiscal_quarter}`;
  const parts = [
    `${report.ticker} ${period} năm ${report.fiscal_year}`,
    `${extraction.factCount} chỉ tiêu`,
  ];
  if (extraction.rejected.length > 0) {
    parts.push(`loại ${extraction.rejected.length} số chưa đáng tin`);
  }
  return [...parts, ...extraction.warnings].join(" · ");
}

// Modal upload nhiều file với 4 tab theo trạng thái xử lý.
// Component luôn được giữ trên trang nên đóng modal không dừng việc xử lý.
export default function DocumentUploadModal({ open, onClose }: DocumentUploadModalProps) {
  const queue = useDocumentQueue(open);
  const { items, documents, serverProgress } = queue;
  const [modal, contextHolder] = Modal.useModal();

  const queueFileIds = new Set(items.map((item) => item.fileId));
  const activeItems = items.filter((item) => item.phase !== "failed");
  const failedItems = items.filter((item) => item.phase === "failed");

  // Tài liệu có trong hàng đợi đã hiện ở dòng của hàng đợi nên không hiện lại.
  const byGroup = (group: string) =>
    documents.filter(
      (document) => getDocumentGroup(document) === group && !queueFileIds.has(document.id),
    );

  // Hỏi xác nhận trước khi xoá, vì thao tác này không hoàn tác được.
  const confirmDelete = (name: string, onConfirm: () => void | Promise<void>) => {
    modal.confirm({
      title: "Xoá tài liệu?",
      content: `"${name}" cùng nội dung và số liệu trích từ file này sẽ bị xoá vĩnh viễn.`,
      okText: "Xoá",
      cancelText: "Huỷ",
      okButtonProps: { danger: true },
      onOk: onConfirm,
    });
  };

  const deleteAction = (document: DocumentRecord) => (
    <IconAction
      label="Xoá"
      icon={<AiOutlineDelete size={16} />}
      onClick={() =>
        confirmDelete(document.file_name, () => queue.deleteDocument(document))
      }
    />
  );

  const activeRows = [
    ...activeItems.map((item) => {
      // Đã lên server thì dùng tiến độ server gửi về, còn lại dùng tiến độ trên trình duyệt.
      const progress = item.phase === "processing"
        ? (serverProgress[item.fileId ?? ""] ?? PREPARING_PROGRESS)
        : item.progress;
      return (
        <FileRow
          key={item.id}
          name={item.name}
          description={progress.label}
          progress={progress}
          actions={
            <IconAction
              label="Huỷ"
              icon={<AiOutlineStop size={16} />}
              onClick={() => void queue.cancelItem(item)}
            />
          }
        />
      );
    }),
    ...byGroup("active").map((document) => {
      const progress = serverProgress[document.id] ?? PREPARING_PROGRESS;
      return (
        <FileRow
          key={document.id}
          name={document.file_name}
          description={progress.label}
          progress={progress}
          actions={
            <IconAction
              label="Huỷ"
              icon={<AiOutlineStop size={16} />}
              onClick={() => void queue.cancelDocument(document)}
            />
          }
        />
      );
    }),
  ];

  const successRows = byGroup("success").map((document) => (
    <FileRow
      key={document.id}
      name={document.file_name}
      description={describeSuccess(document)}
      actions={deleteAction(document)}
    />
  ));

  const contentOnlyRows = byGroup("content_only").map((document) => (
    <FileRow
      key={document.id}
      name={document.file_name}
      description={CONTENT_ONLY_DESCRIPTION}
      actions={deleteAction(document)}
    />
  ));

  const failedRows = [
    ...failedItems.map((item) => (
      <FileRow
        key={item.id}
        name={item.name}
        description={item.error ?? ""}
        actions={
          <>
            <IconAction
              label="Thử lại"
              icon={<AiOutlineReload size={16} />}
              onClick={() => queue.retryItem(item)}
            />
            <IconAction
              label="Xoá"
              icon={<AiOutlineDelete size={16} />}
              onClick={() => confirmDelete(item.name, () => queue.removeItem(item.id))}
            />
          </>
        }
      />
    )),
    ...byGroup("failed").map((document) => (
      <FileRow
        key={document.id}
        name={document.file_name}
        description={getFailureReason(document)}
        actions={
          <>
            <IconAction
              label="Thử lại"
              icon={<AiOutlineReload size={16} />}
              onClick={() => queue.retryDocument(document)}
            />
            {deleteAction(document)}
          </>
        }
      />
    )),
  ];

  const tabs = [
    { key: "active", title: "Đang xử lý", rows: activeRows, empty: "Không có file đang xử lý" },
    { key: "success", title: "Thành công", rows: successRows, empty: "Chưa có file thành công" },
    {
      key: "content_only",
      title: "Chỉ có nội dung",
      rows: contentOnlyRows,
      empty: "Không có file chỉ lưu nội dung",
    },
    { key: "failed", title: "Thất bại", rows: failedRows, empty: "Không có file thất bại" },
  ];

  return (
    <ConfigProvider theme={MODAL_THEME}>
      {contextHolder}
      <Modal
        title="Tải tài liệu"
        open={open}
        onCancel={onClose}
        footer={null}
        width={MODAL_WIDTH}
        centered
      >
        <Upload.Dragger
          accept="application/pdf"
          multiple
          showUploadList={false}
          // Tự quản lý việc gửi file; LIST_IGNORE để antd không tự upload hay lưu danh sách.
          beforeUpload={(file) => {
            queue.enqueue(file);
            return Upload.LIST_IGNORE;
          }}
        >
          <Flex vertical align="center" gap={4}>
            <AiOutlineInbox size={32} />
            <Typography.Text>Kéo thả hoặc bấm để chọn nhiều file PDF</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Mỗi file tối đa 20 MB
            </Typography.Text>
          </Flex>
        </Upload.Dragger>

        <Tabs
          items={tabs.map((tab) => ({
            key: tab.key,
            label: `${tab.title} (${tab.rows.length})`,
            children: (
              <div style={{ height: 280, overflowY: "auto" }}>
                {tab.rows.length > 0 ? (
                  tab.rows
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tab.empty} />
                )}
              </div>
            ),
          }))}
        />
      </Modal>
    </ConfigProvider>
  );
}
