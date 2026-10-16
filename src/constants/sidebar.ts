export const SOCIAL_SHARE_URLS = {
  linkedin: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  facebook: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  twitter: (url: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
  reddit: (url: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}`,
} as const;

export const MODAL_TEXTS = {
  share: {
    title: "Đường liên kết công khai có thể chia sẻ",
    warning: "Bất kỳ ai có đường liên kết này đều có thể xem cuộc hội thoại này. Hãy chia sẻ đường liên kết một cách có trách nhiệm.",
    copyButton: "Sao chép đường liên kết",
  },
  delete: {
    title: "Bạn muốn xoá cuộc trò chuyện?",
    content: "Thao tác này sẽ xoá các câu lệnh, câu trả lời và ý kiến phản hồi khỏi Hoạt động của bạn trên Các ứng dụng Gemini, cũng như mọi nội dung bạn đã tạo.",
    cancelButton: "Hủy",
    confirmButton: "Xóa",
  },
  rename: {
    title: "Đổi tên cho cuộc trò chuyện này",
    placeholder: "Nhập tên mới...",
    cancelButton: "Hủy",
    confirmButton: "Đổi tên",
  },
} as const;

export const POPOVER_OPTIONS = {
  share: "Chia sẻ",
  pin: "Ghim",
  unpin: "Bỏ ghim",
  rename: "Đổi tên",
  delete: "Xóa",
  upload: "Tải tệp lên",
} as const;
