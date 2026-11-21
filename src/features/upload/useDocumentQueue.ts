// Hàng đợi xử lý tài liệu. Từng việc chạy lần lượt, vì OCR tốn nhiều CPU và RAM.
//
// Thuật ngữ:
//   - Hàng đợi (queue): danh sách việc chờ làm, việc vào trước được làm trước.
//   - SSE (Server-Sent Events): server giữ một kết nối và tự gửi sự kiện xuống trình duyệt.
//   - EventSource: API của trình duyệt để nhận SSE, tự kết nối lại khi bị ngắt.
//   - useRef: lưu giá trị giữa các lần render mà không làm giao diện vẽ lại.
//   - AbortController: cơ chế chuẩn để báo một tác vụ đang chạy phải dừng lại.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { UPLOAD_PURPOSE } from "@/constants/files";
import { uploadProgress, WAITING_PROGRESS, type DocumentProgress } from "@/constants/progress";
import { apiClient } from "@/lib/axios";
import { summarizeError } from "@/utils/error-message";
import { ocrProcessApi } from "@/features/ocr-process/ocr-process.api";
import { documentsApi, type DocumentRecord } from "./documents";
import { uploadApi } from "./upload.api";

const DOCUMENTS_KEY = ["documents", "list"];

export type QueueItem = {
  id: string;
  name: string;
  phase: "waiting" | "uploading" | "processing" | "failed";
  // Tiến độ lúc còn ở trình duyệt; khi đã lên server thì dùng tiến độ server gửi về.
  progress: DocumentProgress;
  fileId?: string;
  error?: string;
};

type QueueJob = {
  id: string;
  run: (signal: AbortSignal) => Promise<void>;
};

// Lấy thông báo lỗi dễ đọc; API trả lỗi trong response.data.error.
function getErrorMessage(error: unknown): string {
  const apiError = error as { response?: { data?: { error?: string } } };
  if (apiError.response?.data?.error) return summarizeError(apiError.response.data.error);
  return error instanceof Error ? summarizeError(error.message) : "Xử lý tài liệu thất bại.";
}

// Bỏ qua lỗi server đã trả về khi xử lý, vì lý do đã được ghi vào file và hiện ở tab Thất bại.
// Lỗi không có response là lỗi mạng, chưa được ghi ở đâu nên vẫn phải báo.
function ignoreServerError(error: unknown) {
  if (!axios.isAxiosError(error) || !error.response) throw error;
}

// Quản lý hàng đợi trên trình duyệt và danh sách tài liệu trên server.
export function useDocumentQueue(enabled: boolean) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<QueueItem[]>([]);

  // Tiến độ server gửi về, theo id của file.
  const [serverProgress, setServerProgress] = useState<Record<string, DocumentProgress>>({});

  const pendingJobs = useRef<QueueJob[]>([]);
  const isRunning = useRef(false);

  // Tín hiệu dừng của việc đang chạy, dùng để huỷ lúc đang upload.
  const activeJob = useRef<{ id: string; controller: AbortController } | null>(null);

  // File thật nằm ở đây để thử lại được khi upload lỗi; File không phải dữ liệu hiển thị.
  const localFiles = useRef(new Map<string, File>());

  const hasQueueWork = items.some((item) => item.phase !== "failed");

  const documents = useQuery({
    queryKey: DOCUMENTS_KEY,
    queryFn: ({ signal }) => documentsApi.getAll(signal),
    enabled: enabled || hasQueueWork,
  });

  // Tải lại danh sách tài liệu từ server. Sự kiện SSE và hàng đợi cùng gọi hàm này khi một file
  // xong, nên cancelRefetch: false giữ request đang chạy thay vì huỷ nó để gửi request mới.
  const refreshDocuments = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }, { cancelRefetch: false }),
    [queryClient],
  );

  // Nhận tiến độ qua SSE trong lúc modal mở. Đóng modal thì ngắt kết nối,
  // vì không ai xem tiến độ; việc xử lý ở server vẫn chạy tiếp.
  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(`${apiClient.defaults.baseURL}/files/events`);

    source.addEventListener("progress", (event) => {
      const { fileId, progress } = JSON.parse(event.data);
      setServerProgress((current) => ({ ...current, [fileId]: progress }));
    });

    // Giữ tiến độ cuối của file, để thanh không tụt lại trong lúc chờ file rời hàng đợi.
    source.addEventListener("done", () => void refreshDocuments());

    // Tải lại danh sách khi kết nối hoặc kết nối lại, để không bỏ lót sự kiện lúc bị ngắt.
    source.onopen = () => void refreshDocuments();

    return () => source.close();
  }, [enabled, refreshDocuments]);

  // Cập nhật một phần thông tin của một việc trong hàng đợi.
  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  // Bỏ một việc khỏi hàng đợi hiển thị và quên file đi kèm.
  const removeItem = useCallback((id: string) => {
    localFiles.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  // Chạy lần lượt các việc; isRunning bảo đảm chỉ có một vòng lặp chạy.
  const runQueue = useCallback(async () => {
    if (isRunning.current) return;
    isRunning.current = true;

    for (let job = pendingJobs.current.shift(); job; job = pendingJobs.current.shift()) {
      const controller = new AbortController();
      activeJob.current = { id: job.id, controller };

      try {
        await job.run(controller.signal);
        await refreshDocuments();
        removeItem(job.id);
      } catch (error) {
        if (axios.isCancel(error)) {
          removeItem(job.id);
        } else {
          updateItem(job.id, { phase: "failed", error: getErrorMessage(error) });
        }
      }
    }

    activeJob.current = null;
    isRunning.current = false;
  }, [refreshDocuments, removeItem, updateItem]);

  // Tạo việc upload một file rồi chờ server xử lý xong.
  const createUploadJob = useCallback(
    (id: string, file: File): QueueJob => ({
      id,
      run: async (signal) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", UPLOAD_PURPOSE.KNOWLEDGE_BASE);

        updateItem(id, { phase: "uploading", progress: uploadProgress(0), error: undefined });
        const uploaded = await uploadApi.upload(
          formData,
          (percent) => updateItem(id, { progress: uploadProgress(percent) }),
          signal,
        );

        updateItem(id, { phase: "processing", fileId: uploaded.fileId });
        await ocrProcessApi.process(uploaded.fileId).catch(ignoreServerError);
      },
    }),
    [updateItem],
  );

  // Thêm một file vào cuối hàng đợi và khởi động vòng xử lý nếu đang rảnh.
  const enqueue = useCallback(
    (file: File) => {
      const id = crypto.randomUUID();
      localFiles.current.set(id, file);
      pendingJobs.current.push(createUploadJob(id, file));
      setItems((current) => [
        ...current,
        { id, name: file.name, phase: "waiting", progress: WAITING_PROGRESS },
      ]);
      void runQueue();
    },
    [createUploadJob, runQueue],
  );

  // Thử lại một tài liệu trên server: có nội dung OCR thì chỉ trích số, chưa có thì chạy từ đầu.
  const retryDocument = useCallback(
    (document: DocumentRecord) => {
      const id = crypto.randomUUID();
      pendingJobs.current.push({
        id,
        run: async () => {
          updateItem(id, { phase: "processing" });
          const request = document.has_content
            ? ocrProcessApi.retry(document.id)
            : ocrProcessApi.process(document.id);
          await request.catch(ignoreServerError);
        },
      });
      setItems((current) => [
        ...current,
        {
          id,
          name: document.file_name,
          phase: "waiting",
          progress: WAITING_PROGRESS,
          fileId: document.id,
        },
      ]);
      void runQueue();
    },
    [runQueue, updateItem],
  );

  // Thử lại file bị lỗi lúc upload, tức là chưa lên được server.
  const retryItem = useCallback(
    (item: QueueItem) => {
      const file = localFiles.current.get(item.id);
      if (!file) return;

      updateItem(item.id, { phase: "waiting", progress: WAITING_PROGRESS, error: undefined });
      pendingJobs.current.push(createUploadJob(item.id, file));
      void runQueue();
    },
    [createUploadJob, runQueue, updateItem],
  );

  // Huỷ một việc trong hàng đợi, cách huỷ tuỳ vào việc đó đang ở giai đoạn nào.
  const cancelItem = useCallback(
    async (item: QueueItem) => {
      if (item.phase === "waiting") {
        pendingJobs.current = pendingJobs.current.filter((job) => job.id !== item.id);
        removeItem(item.id);
        return;
      }
      if (item.phase === "uploading" && activeJob.current?.id === item.id) {
        activeJob.current.controller.abort();
        return;
      }
      if (item.fileId) {
        await documentsApi.cancel(item.fileId);
        await refreshDocuments();
      }
    },
    [refreshDocuments, removeItem],
  );

  // Huỷ tài liệu đang chạy trên server nhưng không có trong hàng đợi, ví dụ sau khi tải lại trang.
  const cancelDocument = useCallback(
    async (document: DocumentRecord) => {
      await documentsApi.cancel(document.id);
      await refreshDocuments();
    },
    [refreshDocuments],
  );

  // Xoá tài liệu trên server.
  const deleteDocument = useCallback(
    async (document: DocumentRecord) => {
      await documentsApi.delete(document.id);
      await refreshDocuments();
    },
    [refreshDocuments],
  );

  return {
    items,
    documents: documents.data ?? [],
    serverProgress,
    enqueue,
    retryDocument,
    retryItem,
    cancelItem,
    cancelDocument,
    deleteDocument,
    removeItem,
  };
}
