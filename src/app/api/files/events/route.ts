// Đẩy tiến độ xử lý tài liệu xuống trình duyệt bằng SSE.
//
// Thuật ngữ:
//   - SSE (Server-Sent Events): trình duyệt mở một kết nối, server giữ kết nối đó và tự gửi
//     dữ liệu xuống mỗi khi có sự kiện, thay vì trình duyệt phải hỏi lặp lại.
//   - ReadableStream: luồng dữ liệu được gửi dần từng phần thay vì trả về một lần.
//   - Heartbeat: dòng gửi định kỳ để giữ kết nối, tránh bị coi là nhàn rỗi và bị ngắt.

import { connection } from "next/server";

import { subscribeJobs, type JobEvent } from "@/server/processing-jobs";

const HEARTBEAT_MS = 20_000;

// Viết sự kiện theo định dạng của SSE: dòng event, dòng data, rồi một dòng trống.
function formatEvent(event: JobEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

// Mở luồng SSE và giữ đến khi trình duyệt ngắt kết nối.
export async function GET(request: Request) {
  await connection();

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      const unsubscribe = subscribeJobs((event) => send(formatEvent(event)));

      // Dòng bắt đầu bằng dấu hai chấm là chú thích, trình duyệt sẽ bỏ qua.
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      request.signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      // no-transform ngăn lớp nén gom dữ liệu lại, khiến sự kiện đến trễ.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
