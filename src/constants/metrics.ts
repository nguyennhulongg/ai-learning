// Danh mục chỉ tiêu tài chính dùng chung cho script nhập liệu và tool tra cứu của chatbot.
// Mỗi chỉ tiêu có một mã cố định, vì mỗi công ty ghi tên chỉ tiêu trong báo cáo một kiểu.
//
// Thuật ngữ:
//   - Bảng cân đối kế toán: tài sản, nợ và vốn tại một thời điểm.
//   - Kết quả kinh doanh: doanh thu, chi phí và lợi nhuận trong một kỳ.
//   - Lưu chuyển tiền tệ: dòng tiền vào và ra trong một kỳ.
//   - Công ty mẹ: phần lợi nhuận thuộc cổ đông của công ty niêm yết, sau khi trừ phần của
//     cổ đông thiểu số ở các công ty con.
//   - EPS (earnings per share): lợi nhuận trên mỗi cổ phiếu.

export const STATEMENTS = {
  BALANCE_SHEET: "balance_sheet",
  INCOME_STATEMENT: "income_statement",
  CASH_FLOW: "cash_flow",
} as const;

export type Statement = (typeof STATEMENTS)[keyof typeof STATEMENTS];

export type MetricDefinition = {
  statement: Statement;
  label: string;
  // Mã số của dòng trên báo cáo doanh nghiệp theo chuẩn kế toán Việt Nam (VAS).
  // Tên chỉ tiêu dễ nhầm với dòng gần giống, còn mã số thì cố định.
  // Mẫu báo cáo của ngân hàng khác nên chỉ tiêu riêng của ngân hàng không có mã số.
  line_code?: number;
};

export const METRICS: Record<string, MetricDefinition> = {
  // Bảng cân đối kế toán
  total_assets: { statement: "balance_sheet", label: "Tổng tài sản", line_code: 270 },
  current_assets: { statement: "balance_sheet", label: "Tài sản ngắn hạn", line_code: 100 },
  cash_and_equivalents: { statement: "balance_sheet", label: "Tiền và tương đương tiền", line_code: 110 },
  inventories: { statement: "balance_sheet", label: "Hàng tồn kho", line_code: 140 },
  total_liabilities: { statement: "balance_sheet", label: "Nợ phải trả", line_code: 300 },
  short_term_debt: { statement: "balance_sheet", label: "Vay ngắn hạn", line_code: 320 },
  long_term_debt: { statement: "balance_sheet", label: "Vay dài hạn", line_code: 338 },
  equity: { statement: "balance_sheet", label: "Vốn chủ sở hữu", line_code: 400 },

  // Kết quả kinh doanh
  net_revenue: { statement: "income_statement", label: "Doanh thu thuần", line_code: 10 },
  gross_profit: { statement: "income_statement", label: "Lợi nhuận gộp", line_code: 20 },
  profit_before_tax: { statement: "income_statement", label: "Lợi nhuận trước thuế", line_code: 50 },
  net_profit: { statement: "income_statement", label: "Lợi nhuận sau thuế", line_code: 60 },
  net_profit_parent: {
    statement: "income_statement",
    label: "Lợi nhuận sau thuế của công ty mẹ",
    line_code: 61,
  },
  eps: { statement: "income_statement", label: "Lãi cơ bản trên cổ phiếu", line_code: 70 },

  // Lưu chuyển tiền tệ
  operating_cash_flow: { statement: "cash_flow", label: "Lưu chuyển tiền từ hoạt động kinh doanh", line_code: 20 },
  investing_cash_flow: { statement: "cash_flow", label: "Lưu chuyển tiền từ hoạt động đầu tư", line_code: 30 },
  financing_cash_flow: { statement: "cash_flow", label: "Lưu chuyển tiền từ hoạt động tài chính", line_code: 40 },

  // Chỉ tiêu riêng của ngân hàng
  customer_loans: { statement: "balance_sheet", label: "Cho vay khách hàng" },
  customer_deposits: { statement: "balance_sheet", label: "Tiền gửi của khách hàng" },
  net_interest_income: { statement: "income_statement", label: "Thu nhập lãi thuần" },
  total_operating_income: { statement: "income_statement", label: "Tổng thu nhập hoạt động" },
  credit_provision_expense: { statement: "income_statement", label: "Chi phí dự phòng rủi ro tín dụng" },
};

// Đơn vị được phép nhập. EPS dùng vnd_per_share vì là số đồng trên một cổ phiếu.
export const UNITS = ["vnd", "million_vnd", "billion_vnd", "vnd_per_share"] as const;
