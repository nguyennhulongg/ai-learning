"use client";

import { AiOutlineUpload } from "react-icons/ai";
import { useUploadFile } from "@/features/upload/upload.mutations";
import { POPOVER_OPTIONS } from "@/constants/sidebar";
import { UploadedFile } from "./ChatInput";
import { createStaticStyles } from 'antd-style'
import { Button, Popover, Upload, UploadProps } from "antd";
import { UPLOAD_PURPOSE } from "@/constants/files";

interface UploadButtonProps {
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  handleUpload: (file: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
}

const popoverClassNames = createStaticStyles(({ css }) => ({
  root: css`
    border-radius: 20px !important;
  `,
}));

export default function UploadButton({
  popoverOpen,
  onPopoverOpenChange,
  handleUpload,
  uploadedFiles,
}: UploadButtonProps) {

  const uploadMutation = useUploadFile();

  const props: UploadProps = {
    name: 'file',
    action: '/api/upload',
    onChange: (info) => {
      handleUpload(info.fileList)
    },
    customRequest: async (options) => {
      const { onSuccess, onError, file } = options;
      try {
        const formData = new FormData();
        formData.append('file', file as any);
        formData.append('purpose', UPLOAD_PURPOSE.PROMPT_ATTACHMENT);

        const data = await uploadMutation.mutateAsync(formData);
        onSuccess?.(data);
        onPopoverOpenChange(false);
      } catch (error) {
        onError?.(error as Error);
      }
    },
    showUploadList: false,
    fileList: uploadedFiles,
  };

  return (
    <Popover
      arrow={false}
      open={popoverOpen}
      onOpenChange={onPopoverOpenChange}
      classNames={popoverClassNames}
      content={
        <div style={{ width: "224px" }}>
          <Upload {...props} style={{ width: "100%" }}>
            <Button
              block
              type="text"
              style={{ color: "var(--text-primary)", justifyContent: "flex-start" }}
              className="rounded-full"
              icon={<AiOutlineUpload size={14} />}
            >
              {POPOVER_OPTIONS.upload}
            </Button>
          </Upload>
        </div>
      }
      trigger="click"
      placement="bottom"
    >
      <Button
        type="text"
        aria-label="Thêm"
        icon={
          <svg
            className="w-6 h-6"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        }
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      />
    </Popover>
  );
}
