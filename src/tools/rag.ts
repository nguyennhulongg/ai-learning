import { tool } from "ai";
import z from "zod";
import { retrieveContext } from "../../lib/rag";

export const rag = {
    searchKnowledgeBase: tool({
        description: "Tìm kiếm thông tin trong cơ sở dữ liệu",
        inputSchema: z.object({
            query: z.string().describe('Khi trong prompt có chứa từ khóa liên quan đến "tìm kiếm trong DB"'),
        }),
        execute: async ({ query }) => {
            const matchedContext = await retrieveContext(query);
            return { matchedContext };
        },
    }),
};
