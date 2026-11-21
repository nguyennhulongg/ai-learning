// Điền cột industry cho các mã còn trống. Mã không suy được ngành vẫn được giữ lại.
// Phải chạy sau import:companies.
//
// Chạy thử, chỉ in kết quả:  npm run import:industries -- --dry-run
// Chạy thật:                 npm run import:industries
//
// Thứ tự ưu tiên: giá trị đã có trong DB, 2 file danh sách ngành, rồi suy từ tên công ty.
// Tên công ty chỉ là gợi ý, nên kết quả suy ra có thể sai với công ty đa ngành.
//
// Thuật ngữ:
//   - Dry run (chạy thử): chạy toàn bộ logic nhưng không ghi gì vào DB.
//   - Regex (regular expression): mẫu để tìm chuỗi ký tự trong văn bản.
//   - NFC: dạng chuẩn của chữ Unicode, gom chữ có dấu về một ký tự để so khớp chính xác.

import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { companies } from "@/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

// Danh sách công ty theo ngành, nguồn đáng tin hơn việc suy từ tên.
const INDUSTRY_FILES: Record<string, string> = {
  "ngan-hang.json": "banking",
  "chung-khoan.json": "securities",
};

// Quy tắc suy ngành từ tên. Quy tắc đứng trước được ưu tiên, nên ngành cụ thể phải đặt trước:
// "Chứng khoán Ngân hàng ..." là chứng khoán, nên banking chỉ khớp ở đầu tên (dấu ^).
// "Dầu khí" và "Điện lực" thường là tên tập đoàn mẹ, như "Phân bón Dầu khí" hay
// "Bất động sản Điện lực", nên 2 từ này đặt sau các từ chỉ hoạt động chính.
const NAME_RULES: [RegExp, string][] = [
  [/^(ngân hàng|nh )/, "banking"],
  [/chứng khoán/, "securities"],
  [/quản lý quỹ/, "fund_management"],
  [/bảo hiểm/, "insurance"],
  [/thép|kim khí/, "steel"],
  [/xi măng/, "cement"],
  [/thủy điện|thuỷ điện|nhiệt điện|phát điện|điện gió|điện mặt trời/, "power"],
  [/cao su/, "rubber"],
  [/dược|bệnh viện|thiết bị y tế|vật tư y tế/, "healthcare"],
  [/thủy sản|thuỷ sản|hải sản/, "seafood"],
  [/dệt|may mặc|sợi|(^|\s)may(\s|$)/, "textile"],
  [/nhựa/, "plastics"],
  [/phân bón|phân đạm|hóa chất|hoá chất/, "chemicals"],
  [/khoáng sản|(^|\s)than(\s|$)/, "mining"],
  [/bất động sản|địa ốc|phát triển nhà|phát triển đô thị|khu công nghiệp/, "real_estate"],
  [/xây dựng|xây lắp|cầu đường|công trình/, "construction"],
  [/vận tải|hàng hải|logistics|kho vận|(^|\s)cảng(\s|$)|hàng không|đường sắt/, "transportation"],
  [/điện lực|năng lượng/, "power"],
  [/dầu khí|xăng dầu|lọc.*dầu|hóa dầu|hoá dầu|khí việt nam/, "oil_gas"],
  [/phần mềm|công nghệ thông tin|viễn thông/, "technology"],
  [/thực phẩm|lương thực|(^|\s)sữa(\s|$)|(^|\s)bia(\s|$)|rượu|mía đường|thức ăn/, "food_beverage"],
  [/du lịch|khách sạn/, "tourism"],
];

type IndustryFileRow = {
  Symbol: string;
};

// Đọc các file danh sách ngành thành bảng tra cứu từ mã sang ngành.
function readIndustryFiles(): Map<string, string> {
  const industries = new Map<string, string>();

  for (const [fileName, industry] of Object.entries(INDUSTRY_FILES)) {
    const filePath = path.join(process.cwd(), "data", fileName);
    const text = readFileSync(filePath, "utf8").replace(/^﻿/, "");
    const rows: IndustryFileRow[] = JSON.parse(text);

    for (const row of rows) {
      industries.set(row.Symbol, industry);
    }
  }

  return industries;
}

// Suy ngành từ tên công ty, trả về null nếu không có quy tắc nào khớp.
function inferFromName(name: string): string | null {
  const normalized = name.normalize("NFC").toLowerCase();
  const rule = NAME_RULES.find(([pattern]) => pattern.test(normalized));
  return rule?.[1] ?? null;
}

// Cập nhật industry cho nhiều mã bằng một lệnh UPDATE, chỉ ghi vào mã còn trống.
async function updateIndustries(rows: { ticker: string; industry: string }[]) {
  const values = sql.join(
    rows.map((row) => sql`(${row.ticker}, ${row.industry})`),
    sql`, `,
  );

  await db.execute(sql`
    update ${companies}
    set industry = source.industry, updated_at = now()
    from (values ${values}) as source(ticker, industry)
    where ${companies.ticker} = source.ticker
      and ${companies.industry} is null
  `);
}

// Đếm số lần xuất hiện của từng giá trị rồi in, giá trị nhiều nhất đứng trước.
function printCounts(title: string, values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  console.log(title);
  for (const [value, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${value}: ${count}`);
  }
}

// Tính kết quả, in thống kê, rồi ghi vào DB nếu không phải chạy thử.
async function main() {
  const rows = await db.select().from(companies);
  const fileIndustries = readIndustryFiles();

  const updates = rows.flatMap((row) => {
    if (row.industry) return [];
    const industry =
      fileIndustries.get(row.ticker) ?? inferFromName(row.name);
    return industry ? [{ ticker: row.ticker, name: row.name, industry }] : [];
  });

  printCounts(
    `Sẽ điền industry cho ${updates.length} mã:`,
    updates.map((row) => row.industry),
  );

  if (DRY_RUN) {
    for (const row of updates) {
      console.log(`UPDATE\t${row.industry}\t${row.ticker}\t${row.name}`);
    }
    console.log("Chạy thử: chưa ghi gì vào DB.");
    await db.$client.end();
    return;
  }

  if (updates.length > 0) {
    await updateIndustries(updates);
  }

  console.log("Đã ghi vào DB.");
  await db.$client.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
