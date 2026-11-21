// Nhập danh sách cổ phiếu từ data/companies.json vào bảng companies.
// Phải chạy trước khi nhập báo cáo, vì reports có khoá ngoại (foreign key) tới companies:
// DB từ chối báo cáo của một mã chưa tồn tại.
//
// Chạy bằng: npm run import:companies
//
// Dữ liệu đến từ 2 file:
//   - companies.json: danh sách gốc, có mã, tên và sàn nhưng không có ngành.
//   - companies.csv: ngành của một số mã, được điền bổ sung vào danh sách trên.
//
// Thuật ngữ:
//   - JSON: định dạng văn bản lưu dữ liệu có cấu trúc.
//   - CSV (comma-separated values): file văn bản dạng bảng, các cột cách nhau bằng dấu phẩy.
//   - OTC (over-the-counter): cổ phiếu chưa lên sàn, không có báo cáo theo chuẩn niêm yết.
//   - ETF (exchange-traded fund): quỹ giao dịch trên sàn như một cổ phiếu.
//   - Upsert (update + insert): có dòng rồi thì cập nhật, chưa có thì thêm mới.
//     Nhờ vậy chạy lại script nhiều lần cũng không tạo dữ liệu trùng.

import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { companies, type NewCompany } from "@/db/schema";

const JSON_PATH = path.join(process.cwd(), "data", "companies.json");
const CSV_PATH = path.join(process.cwd(), "data", "companies.csv");

// Bảng đổi CenterId của nguồn dữ liệu sang tên sàn.
// Các giá trị khác, như 8 là OTC, không có trong bảng nên bị loại.
const EXCHANGES: Record<number, string> = {
  1: "HOSE",
  2: "HNX",
  9: "UPCOM",
};

// Mã cổ phiếu luôn có đúng 3 ký tự. Trái phiếu, chứng quyền, ETF và chỉ số đều dài hơn,
// nên lọc theo định dạng mã an toàn hơn dò từ khoá trong tên:
// ví dụ DCV có chữ "quỹ đầu tư" trong tên nhưng là công ty, không phải quỹ.
const STOCK_TICKER = /^[A-Z0-9]{3}$/;

type SourceRow = {
  Symbol: string;
  Title: string;
  CenterId: number;
};

// Đọc file văn bản UTF-8 và bỏ BOM (dấu byte vô hình ở đầu file, một số trình soạn thảo tự thêm).
function readText(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/^﻿/, "");
}

// Đọc companies.csv thành bảng tra cứu từ mã sang ngành.
// Map là cấu trúc lưu cặp khoá - giá trị, tra cứu theo khoá rất nhanh.
function readIndustries(filePath: string): Map<string, string> {
  const [header, ...rows] = readText(filePath)
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  const columns = header.split(",");
  const tickerIndex = columns.indexOf("ticker");
  const industryIndex = columns.indexOf("industry");

  return new Map(
    rows.map((row) => {
      const values = row.split(",");
      return [values[tickerIndex].trim(), values[industryIndex].trim()];
    }),
  );
}

// Giữ lại các dòng là cổ phiếu trên 3 sàn và đổi sang đúng cấu trúc của bảng companies.
function toCompanies(
  rows: SourceRow[],
  industries: Map<string, string>,
): NewCompany[] {
  return rows
    .filter(
      (row) => row.CenterId in EXCHANGES && STOCK_TICKER.test(row.Symbol),
    )
    .map((row) => ({
      ticker: row.Symbol,
      name: row.Title.trim(),
      exchange: EXCHANGES[row.CenterId],
      industry: industries.get(row.Symbol) ?? null,
    }));
}

// Ghi danh sách công ty vào DB, in thống kê, rồi đóng kết nối để script kết thúc được.
// Toàn bộ nằm trong một lệnh insert nên các dòng cùng thành công hoặc cùng thất bại.
async function main() {
  const sourceRows: SourceRow[] = JSON.parse(readText(JSON_PATH));
  const rows = toCompanies(sourceRows, readIndustries(CSV_PATH));

  await db
    .insert(companies)
    .values(rows)
    .onConflictDoUpdate({
      target: companies.ticker,
      set: {
        // excluded là dòng mới vừa bị trùng khoá, nên lấy giá trị từ đó để cập nhật.
        name: sql`excluded.name`,
        exchange: sql`excluded.exchange`,
        // coalesce lấy giá trị đầu tiên khác NULL, nên ngành đã có không bị xoá mất.
        industry: sql`coalesce(excluded.industry, ${companies.industry})`,
        updated_at: new Date(),
      },
    });

  const byExchange = Object.groupBy(rows, (row) => row.exchange);
  console.log(`Đã nhập ${rows.length}/${sourceRows.length} dòng.`);
  for (const [exchange, group] of Object.entries(byExchange)) {
    console.log(`  ${exchange}: ${group?.length ?? 0}`);
  }

  await db.$client.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
