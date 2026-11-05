
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, {
    connect_timeout: 10,
    idle_timeout: 5,
});

try {
    const result = await sql`
    SELECT
      current_database() AS database_name,
      current_schema() AS current_schema
  `;

    console.log("Kết nối thành công:", result);
} catch (error) {
    console.error("Kết nối thất bại:", error);
} finally {
    await sql.end();
}
