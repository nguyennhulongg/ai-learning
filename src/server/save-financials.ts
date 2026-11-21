// Chạy trích số cho một file đã OCR xong, rồi lưu kết quả vào financial_facts.
//
// Lỗi ở bước này không làm mất kết quả OCR, vì OCR đã được lưu trước đó.
//
// Thuật ngữ:
//   - Transaction: gom nhiều lệnh DB thành một khối, cùng thành công hoặc cùng huỷ.
//   - Upsert (update + insert): có dòng rồi thì cập nhật, chưa có thì thêm mới.

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { companies, files, financialFacts, reports, type Report } from "@/db/schema";
import {
  extractFinancials,
  type ExtractablePage,
  type ExtractedFact,
  type ExtractionSummary,
} from "./extract-financials";
import { identifyReport, matchCompany, type IdentifiedReport } from "./identify-report";

// Nguồn của số liệu, phân biệt với số liệu từ cách khác nếu sau này có thêm.
const SOURCE = "pdf_extraction";

export type ExtractionResult = {
  status: "completed" | "no_statements" | "skipped" | "failed";
  report: { ticker: string; fiscal_year: number; fiscal_quarter: number } | null;
  factCount: number;
  rejected: string[];
  warnings: string[];
};

// Đổi một chỉ tiêu đã trích thành dòng của bảng financial_facts.
function toRow(fact: ExtractedFact, reportId: string) {
  return {
    id: randomUUID(),
    report_id: reportId,
    statement: fact.statement,
    metric_code: fact.metric_code,
    source_label: fact.source_label,
    value: fact.value,
    unit: fact.unit,
    source: SOURCE,
    source_page: fact.source_page,
    is_verified: fact.is_verified,
  };
}

// Tạo báo cáo hoặc cập nhật báo cáo cùng kỳ đã có, rồi gắn với file vừa upload.
async function upsertReport(
  ticker: string,
  identified: IdentifiedReport,
  fileId: string,
): Promise<Report> {
  const [report] = await db
    .insert(reports)
    .values({
      id: randomUUID(),
      ticker,
      fiscal_year: identified.fiscal_year,
      fiscal_quarter: identified.fiscal_quarter,
      report_type: identified.report_type,
      audit_status: identified.audit_status,
      file_id: fileId,
    })
    .onConflictDoUpdate({
      target: [
        reports.ticker,
        reports.fiscal_year,
        reports.fiscal_quarter,
        reports.report_type,
      ],
      set: { audit_status: identified.audit_status, file_id: fileId },
    })
    .returning();

  return report;
}

// Lấy các ghi chú của lần trích số để hiện cho người dùng.
function summaryNotes(summary: ExtractionSummary) {
  return { rejected: summary.rejected, warnings: summary.warnings };
}

// Tạo kết quả cho trường hợp không lưu được số liệu.
function skipped(warning: string): ExtractionResult {
  return { status: "skipped", report: null, factCount: 0, rejected: [], warnings: [warning] };
}

// Lưu số liệu của một báo cáo, chỉ thay các chỉ tiêu có trong kết quả mới.
// File mới thiếu chỉ tiêu nào thì số cũ của chỉ tiêu đó vẫn được giữ.
// Báo cáo quý 4 có cả số luỹ kế, nên số đó được lưu vào báo cáo cả năm (fiscal_quarter = 0).
async function saveFacts(report: Report, facts: ExtractedFact[]) {
  await db.transaction(async (tx) => {
    const yearFacts = facts.filter((fact) => fact.is_full_year);
    const periodFacts = facts.filter((fact) => !fact.is_full_year);
    const groups = [{ reportId: report.id, facts: periodFacts }];

    if (yearFacts.length > 0) {
      const [yearReport] = await tx
        .insert(reports)
        .values({
          id: randomUUID(),
          ticker: report.ticker,
          fiscal_year: report.fiscal_year,
          fiscal_quarter: 0,
          report_type: report.report_type,
          audit_status: report.audit_status,
          published_at: report.published_at,
          file_id: report.file_id,
        })
        .onConflictDoUpdate({
          target: [
            reports.ticker,
            reports.fiscal_year,
            reports.fiscal_quarter,
            reports.report_type,
          ],
          set: { file_id: report.file_id },
        })
        .returning({ id: reports.id });

      groups.push({ reportId: yearReport.id, facts: yearFacts });
    }

    for (const group of groups) {
      if (group.facts.length === 0) continue;

      await tx
        .delete(financialFacts)
        .where(
          and(
            eq(financialFacts.report_id, group.reportId),
            eq(financialFacts.source, SOURCE),
            inArray(
              financialFacts.metric_code,
              group.facts.map((fact) => fact.metric_code),
            ),
          ),
        );

      await tx
        .insert(financialFacts)
        .values(group.facts.map((fact) => toRow(fact, group.reportId)));
    }
  });
}

// Nhận diện báo cáo từ nội dung file, trích số rồi lưu.
// Hàm này luôn trả về kết quả thay vì ném lỗi, vì OCR đã lưu xong trước đó.
export async function extractAndSaveFacts(
  fileId: string,
  pages: ExtractablePage[],
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  let result: ExtractionResult;

  try {
    const identified = await identifyReport(pages, signal);
    const companyList = identified
      ? await db.select({ ticker: companies.ticker, name: companies.name }).from(companies)
      : [];
    const ticker = identified && matchCompany(identified.company_name, companyList);

    if (!identified) {
      result = skipped("Không xác định được kỳ báo cáo từ nội dung file.");
    } else if (!ticker) {
      result = skipped(`Không tìm thấy mã cổ phiếu của "${identified.company_name}".`);
    } else {
      const summary = await extractFinancials(pages, identified.fiscal_quarter, signal);

      if (summary.noStatements) {
        result = {
          ...skipped("Không có bảng báo cáo chính."),
          status: "no_statements",
        };
      } else if (summary.facts.length === 0) {
        // Không có số thì không đụng tới báo cáo, tránh file phụ ghi đè báo cáo đã có.
        result = { ...skipped("Không trích được số liệu nào."), ...summaryNotes(summary) };
      } else {
        const report = await upsertReport(ticker, identified, fileId);
        await saveFacts(report, summary.facts);

        result = {
          status: "completed",
          report: {
            ticker,
            fiscal_year: report.fiscal_year,
            fiscal_quarter: report.fiscal_quarter,
          },
          factCount: summary.facts.length,
          ...summaryNotes(summary),
        };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trích số liệu thất bại";
    console.error("Financial extraction error:", { fileId, message });

    result = { status: "failed", report: null, factCount: 0, rejected: [], warnings: [message] };
  }

  // Lưu kết quả cùng file để xem lại được số nào đã bị loại và vì sao.
  await db
    .update(files)
    .set({ metadata: { extraction: result } })
    .where(eq(files.id, fileId));

  return result;
}
