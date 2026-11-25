import { useSyncExternalStore } from "react";

// Cùng mốc với tiền tố lg: của Tailwind (1024px), để JS và CSS luôn thống nhất "đâu là desktop".
const DESKTOP_QUERY = "(min-width: 1024px)";

// Đăng ký lắng nghe khi màn hình vượt qua mốc desktop (xoay máy, kéo cửa sổ...).
function subscribe(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// true khi màn hình rộng từ 1024px.
// useSyncExternalStore: hook của React để đọc một giá trị nằm ngoài React (ở đây là kích thước màn hình)
// và render lại khi nó đổi. Trên server không có window nên trả false (coi như mobile).
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
