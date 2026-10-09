import { tool } from "ai";
import { z } from "zod";

// Mock rates (USD base) — TODO: thay bằng ExchangeRate-API hoặc Fixer.io
const RATES: Record<string, number> = {
  USD: 1,
  VND: 25400,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  KRW: 1340,
  THB: 35.2,
  SGD: 1.34,
  CNY: 7.27,
  AUD: 1.53,
};

export const currencyTools = {
  convertCurrency: tool({
    description: "Chuyển đổi tiền tệ giữa các đơn vị",
    inputSchema: z.object({
      amount: z.number().describe("Số tiền cần chuyển"),
      from: z.string().describe("Đơn vị tiền tệ nguồn, ví dụ: USD"),
      to: z.string().describe("Đơn vị tiền tệ đích, ví dụ: VND"),
    }),
    execute: async ({ amount, from, to }) => {
      const fromRate = RATES[from.toUpperCase()];
      const toRate = RATES[to.toUpperCase()];
      if (!fromRate || !toRate) {
        return { success: false, error: `Không hỗ trợ ${from} hoặc ${to}` };
      }
      const result = (amount / fromRate) * toRate;
      return {
        success: true,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        amount,
        result: Math.round(result * 100) / 100,
        rate: Math.round((toRate / fromRate) * 10000) / 10000,
      };
    },
  }),
};
