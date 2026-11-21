// Lấy nhóm ngành của các công ty từ CafeF và cập nhật cột sector trong bảng companies.
// Script chỉ cập nhật mã đã có trong DB, nên phải chạy import:companies trước.
//
// Chạy bằng: npm run import:sectors
//
// Thuật ngữ:
//   - API: địa chỉ để chương trình gọi và nhận dữ liệu, thay vì người đọc trang web.
//   - Phân trang (pagination): lấy dữ liệu theo từng phần. skip là số dòng bỏ qua,
//     take là số dòng lấy mỗi lần.
//   - Transaction: gom nhiều lệnh DB thành một khối, cùng thành công hoặc cùng huỷ.

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { companies } from "@/db/schema";

const API_URL =
  "https://cafef.vn/du-lieu/ajax/pagenew/databusiness/congtyniemyet.ashx";

// Tự giới thiệu đúng là script cá nhân, không giả làm trình duyệt.
const USER_AGENT = "ai-learning-personal/0.1";

const PAGE_SIZE = 200;

// Nghỉ giữa các lần gọi để không gây tải cho máy chủ của CafeF.
const DELAY_MS = 1000;

// Đưa các nhãn lẻ về nhóm ngành lớn tương ứng.
const SECTOR_ALIASES: Record<string, string> = {
  "Xây dựng": "Bất động sản và Xây dựng",
  "Phần mềm và dịch vụ": "Công nghệ",
  "Chứng khoán và Đầu tư": "Tài chính",
};

// Nhãn phân loại theo sàn giao dịch chứ không phải ngành, nên coi như chưa biết ngành.
const NON_SECTOR_LABELS = new Set(["Doanh nghiệp Upcom", "Doanh nghiệp OTC"]);

type ApiCompany = {
  Symbol: string;
  CategoryName: string | null;
  TotalCompany: number;
};

type ApiResponse = {
  Data: ApiCompany[];
  Success: boolean;
  Message: string | null;
};

// Tạm dừng chương trình trong ms mili-giây.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gọi API một lần để lấy một trang dữ liệu.
async function fetchPage(skip: number): Promise<ApiCompany[]> {
  const params = new URLSearchParams({
    centerid: "0",
    skip: String(skip),
    take: String(PAGE_SIZE),
    // major=0 lấy tất cả; lọc theo nhóm cụ thể sẽ bỏ sót các ngành con.
    major: "0",
  });

  const response = await fetch(`${API_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`CafeF trả về HTTP ${response.status} tại skip=${skip}`);
  }

  const body: ApiResponse = await response.json();
  if (!body.Success) {
    throw new Error(`CafeF báo lỗi: ${body.Message}`);
  }
  return body.Data;
}

// Lấy toàn bộ công ty bằng cách gọi lần lượt từng trang đến khi đủ tổng số.
async function fetchAllCompanies(): Promise<ApiCompany[]> {
  const all: ApiCompany[] = [];
  let total = Infinity;

  while (all.length < total) {
    const page = await fetchPage(all.length);
    if (page.length === 0) break;

    all.push(...page);
    total = page[0].TotalCompany;
    await sleep(DELAY_MS);
  }

  return all;
}

// Chuẩn hoá nhãn ngành của nguồn; trả về null nếu nhãn không phải là ngành.
function normalizeSector(label: string | null): string | null {
  const trimmed = label?.trim();
  if (!trimmed || NON_SECTOR_LABELS.has(trimmed)) return null;
  return SECTOR_ALIASES[trimmed] ?? trimmed;
}

// Cập nhật sector cho nhiều mã bằng một lệnh UPDATE duy nhất.
// VALUES tạo một bảng tạm từ dữ liệu trong bộ nhớ, rồi FROM nối bảng đó với companies,
// nhanh hơn nhiều so với gọi DB riêng cho từng mã.
async function updateSectors(rows: { ticker: string; sector: string }[]) {
  const values = sql.join(
    rows.map((row) => sql`(${row.ticker}, ${row.sector})`),
    sql`, `,
  );

  return db.execute(sql`
    update ${companies}
    set sector = source.sector, updated_at = now()
    from (values ${values}) as source(ticker, sector)
    where ${companies.ticker} = source.ticker
    returning ${companies.ticker}
  `);
}

// Chạy toàn bộ quy trình, in thống kê, rồi đóng kết nối để script kết thúc được.
async function main() {
  const apiCompanies = await fetchAllCompanies();

  const rows = apiCompanies.flatMap((company) => {
    const sector = normalizeSector(company.CategoryName);
    return sector ? [{ ticker: company.Symbol, sector }] : [];
  });

  const updated = await updateSectors(rows);

  console.log(`CafeF trả về ${apiCompanies.length} công ty.`);
  console.log(`Có nhóm ngành: ${rows.length}.`);
  console.log(`Đã cập nhật trong DB: ${updated.length}.`);

  await db.$client.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
