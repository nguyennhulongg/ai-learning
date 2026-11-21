// Theo dõi các file đang được xử lý: huỷ được từ request khác và báo tiến độ cho trình duyệt.
//
// Tiến độ chỉ nằm trong bộ nhớ, vì nó thay đổi liên tục và chỉ có ý nghĩa khi job đang chạy.
//
// Thuật ngữ:
//   - AbortController: cơ chế chuẩn để báo một tác vụ đang chạy phải dừng lại.
//     Tác vụ lắng nghe signal của nó, controller gọi abort() để phát tín hiệu.
//   - Listener: hàm được đăng ký để gọi lại mỗi khi có sự kiện mới.
//   - globalThis: đối tượng toàn cục dùng chung. Mỗi route của Next.js có thể được nạp
//     thành module riêng, nên biến thường trong file này sẽ không được chia sẻ giữa các route.

import { PREPARING_PROGRESS, type DocumentProgress } from "@/constants/progress";

export const CANCEL_MESSAGE = "Đã huỷ xử lý.";

export type JobEvent =
  | { type: "progress"; fileId: string; progress: DocumentProgress }
  | { type: "done"; fileId: string };

type JobListener = (event: JobEvent) => void;

type Job = {
  controller: AbortController;
  progress: DocumentProgress;
};

const globalForJobs = globalThis as typeof globalThis & {
  processingJobs?: Map<string, Job>;
  jobListeners?: Set<JobListener>;
};

const jobs = (globalForJobs.processingJobs ??= new Map());
const listeners = (globalForJobs.jobListeners ??= new Set());

// Gửi một sự kiện tới mọi trình duyệt đang lắng nghe.
function emit(event: JobEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

// Ghi nhận một file bắt đầu xử lý và trả về controller của nó.
export function startJob(fileId: string): AbortController {
  const controller = new AbortController();
  jobs.set(fileId, { controller, progress: PREPARING_PROGRESS });
  emit({ type: "progress", fileId, progress: PREPARING_PROGRESS });
  return controller;
}

// Cập nhật tiến độ của file đang xử lý.
export function updateJob(fileId: string, progress: DocumentProgress) {
  const job = jobs.get(fileId);
  if (!job) return;

  job.progress = progress;
  emit({ type: "progress", fileId, progress });
}

// Bỏ ghi nhận khi xử lý xong. Chỉ xoá nếu vẫn là job này, phòng khi file đã được chạy lại.
export function finishJob(fileId: string, controller: AbortController) {
  if (jobs.get(fileId)?.controller === controller) {
    jobs.delete(fileId);
    emit({ type: "done", fileId });
  }
}

// Phát tín hiệu dừng cho file đang xử lý, nếu có.
export function abortJob(fileId: string) {
  jobs.get(fileId)?.controller.abort(new Error(CANCEL_MESSAGE));
}

// Đăng ký nhận sự kiện. Tiến độ hiện tại được gửi ngay, để trình duyệt vừa kết nối
// hoặc vừa tải lại trang thấy đúng trạng thái. Trả về hàm huỷ đăng ký.
export function subscribeJobs(listener: JobListener): () => void {
  for (const [fileId, job] of jobs) {
    listener({ type: "progress", fileId, progress: job.progress });
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}
