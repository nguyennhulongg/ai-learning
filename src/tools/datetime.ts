import { tool } from "ai";
import { z } from "zod";

export const datetimeTools = {
  getCurrentDateTime: tool({
    description: "Lấy ngày giờ hiện tại",
    inputSchema: z.object({
      timezone: z.string().optional().describe("Múi giờ, ví dụ: Asia/Ho_Chi_Minh"),
    }),
    execute: async ({ timezone = "Asia/Ho_Chi_Minh" }) => {
      const now = new Date();
      return {
        iso: now.toISOString(),
        formatted: now.toLocaleString("vi-VN", { timeZone: timezone }),
        date: now.toLocaleDateString("vi-VN", { timeZone: timezone }),
        time: now.toLocaleTimeString("vi-VN", { timeZone: timezone }),
        timezone,
      };
    },
  }),
};
