import { tool } from "ai";
import { z } from "zod";

export const calculatorTools = {
  calculator: tool({
    description: "Tính toán biểu thức toán học",
    inputSchema: z.object({
      expression: z.string().describe("Biểu thức cần tính, ví dụ: 2 + 2 * 3"),
    }),
    execute: async ({ expression }) => {
      try {
        const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${sanitized})`)();
        return { expression, result, success: true };
      } catch {
        return { expression, result: null, success: false, error: "Biểu thức không hợp lệ" };
      }
    },
  }),
};
