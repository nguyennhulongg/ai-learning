import { tool } from "ai";
import z from "zod";
import { retrieveContext } from "../../lib/rag";

export const rag = {
    searchKnowledgeBase: tool({
        description: "Tìm kiếm thông tin trong cơ sở dữ liệu khi người dùng yêu cầu tìm kiếm thông tin cụ thể. KHÔNG sử dụng khi người dùng yêu cầu không tìm trong cơ sở dữ liệu.",
        inputSchema: z.object({
            query: z.string().describe('Từ khóa tìm kiếm để truy vấn cơ sở dữ liệu'),
        }),
        execute: async ({ query }) => {
            const matchedContext = await retrieveContext(query);
            return { matchedContext };
        },
    }),
};
