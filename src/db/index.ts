import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Số kết nối tối đa của ứng dụng tới DB.
const MAX_CONNECTIONS = 5;

// Đóng kết nối nhàn rỗi sau 20 giây. Máy chủ DB có thể tự ngắt kết nối nhàn rỗi lâu,
// và lần truy vấn tiếp theo trên kết nối đã bị ngắt đó sẽ lỗi.
const IDLE_TIMEOUT_SECONDS = 20;

// globalThis là đối tượng toàn cục, không bị xoá khi Next.js tải lại code lúc phát triển
// (hot reload). Nếu không giữ ở đây, mỗi lần sửa code lại tạo thêm một nhóm kết nối mới.
const globalForDb = globalThis as typeof globalThis & {
  postgresClient?: postgres.Sql;
};

const client =
  globalForDb.postgresClient ??
  postgres(connectionString, {
    max: MAX_CONNECTIONS,
    idle_timeout: IDLE_TIMEOUT_SECONDS,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, { schema });
