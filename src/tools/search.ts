import { tool } from "ai";
import { z } from "zod";

export const searchTools = {
  searchWeb: tool({
    description: "Tìm kiếm thông tin trên web",
    inputSchema: z.object({
      query: z.string().describe("Từ khóa tìm kiếm"),
    }),
    execute: async ({ query }) => {
      // TODO: thay bằng Tavily hoặc Brave Search API
      // const res = await fetch("https://api.tavily.com/search", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query }),
      // });
      return {
        query,
        results: [
          {
            title: `Kết quả 1 cho "${query}"`,
            url: `https://example.com/1`,
            snippet: `Mô tả mẫu cho kết quả đầu tiên về "${query}".`,
          },
          {
            title: `Kết quả 2 cho "${query}"`,
            url: `https://example.com/2`,
            snippet: `Thông tin chi tiết hơn về "${query}".`,
          },
        ],
        note: "Mock data — tích hợp Tavily/Brave API để có kết quả thật.",
      };
    },
  }),
};
