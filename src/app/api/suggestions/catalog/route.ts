import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, reports } from "@/db/schema";
import type { SuggestionCatalog } from "@/features/suggestions/suggestions.types";

// Danh mục cho gợi ý ở ô nhập: các công ty ĐÃ có báo cáo trong DB, kèm các kỳ báo cáo của từng công ty.
// Chỉ lấy công ty có báo cáo để gợi ý luôn trỏ tới dữ liệu hỏi được, không gợi ý mã chưa upload.
// Dữ liệu nhỏ (vài chục mã x vài kỳ) nên trả hết một lần, client tự lọc khi người dùng gõ.
export async function GET() {
  try {
    const rows = await db
      .select({
        ticker: reports.ticker,
        name: companies.name,
        fiscalYear: reports.fiscal_year,
        fiscalQuarter: reports.fiscal_quarter,
      })
      .from(reports)
      .innerJoin(companies, eq(companies.ticker, reports.ticker))
      .orderBy(asc(reports.ticker), desc(reports.fiscal_year), desc(reports.fiscal_quarter));

    // Gộp các dòng (mỗi dòng một báo cáo) thành một mục cho mỗi công ty.
    // Một kỳ có thể có cả báo cáo hợp nhất lẫn riêng → bỏ kỳ trùng.
    const byTicker = new Map<string, SuggestionCatalog[number]>();
    for (const row of rows) {
      let entry = byTicker.get(row.ticker);
      if (!entry) {
        entry = { ticker: row.ticker, name: row.name, periods: [] };
        byTicker.set(row.ticker, entry);
      }
      const isDuplicate = entry.periods.some(
        (p) => p.fiscalYear === row.fiscalYear && p.fiscalQuarter === row.fiscalQuarter,
      );
      if (!isDuplicate) {
        entry.periods.push({ fiscalYear: row.fiscalYear, fiscalQuarter: row.fiscalQuarter });
      }
    }

    return NextResponse.json([...byTicker.values()]);
  } catch (error) {
    console.error("Error loading suggestion catalog:", error);
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }
}
