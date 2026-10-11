import { tool } from "ai";
import z from "zod";
import { retrieveContext } from "../../lib/rag";

export const rag = {
    searchKnowledgeBase: tool({
        description: "Tìm kiếm thông tin trong cơ sở dữ liệu",
        inputSchema: z.object({
            query: z.string().describe('Từ khóa hoặc câu hỏi tối ưu để tìm kiếm trong vector database'),
        }),
        execute: async ({ query }) => {
            const matchedContext = await retrieveContext(query);
            return { matchedContext };
        },
    }),
};
