"use client";

interface WeatherResult {
  city: string;
  temperature: number;
  unit: string;
  condition: string;
  humidity: string;
  wind: string;
}
interface CurrencyResult {
  success: boolean;
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  error?: string;
}
interface DateTimeResult {
  formatted: string;
  date: string;
  time: string;
  timezone: string;
}
interface CalculatorResult {
  expression: string;
  result: number | null;
  success: boolean;
  error?: string;
}
interface SearchResult {
  query: string;
  results: { title: string; url: string; snippet: string }[];
  note?: string;
}
type ToolOutput =
  | WeatherResult
  | CurrencyResult
  | DateTimeResult
  | CalculatorResult
  | SearchResult;

interface ToolCallCardProps {
  toolName: string;
  state: string;
  input: Record<string, unknown>;
  output?: ToolOutput;
}

// Domain nguồn của từng tool — thay bằng domain thật khi dùng API thật
const TOOL_SOURCE: Record<string, { domain: string; label: string }> = {
  getWeather: { domain: "openweathermap.org", label: "OpenWeatherMap" },
  searchWeb: { domain: "tavily.com", label: "Tavily" },
  convertCurrency: {
    domain: "exchangerate-api.com",
    label: "ExchangeRate-API",
  },
  getCurrentDateTime: { domain: "timeanddate.com", label: "Time & Date" },
  calculator: { domain: "wolframalpha.com", label: "Calculator" },
};

const TOOL_LABELS: Record<string, string> = {
  getWeather: "Tra thời tiết",
  getCurrentDateTime: "Lấy giờ hiện tại",
  calculator: "Tính toán",
  searchWeb: "Tìm kiếm web",
  convertCurrency: "Chuyển đổi tiền tệ",
};

function Favicon({ domain, size = 16 }: { domain: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`}
      width={size}
      height={size}
      alt={domain}
      className="rounded-sm"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ background: "#9aa3a2", animationDelay: `${i * 0.15}s` }}
          className="w-1.5 h-1.5 rounded-full animate-bounce"
        />
      ))}
    </div>
  );
}

function SourceBadge({ domain, label }: { domain: string; label: string }) {
  return (
    <div
      style={{ background: "#37353E", color: "#9aa3a2" }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
    >
      <Favicon domain={domain} size={12} />
      {label}
    </div>
  );
}

// ── Tool result cards ─────────────────────────────────────────────────────────

function WeatherCard({
  data,
  source,
}: {
  data: WeatherResult;
  source: (typeof TOOL_SOURCE)[string];
}) {
  const icon = data.condition.includes("Nắng")
    ? "☀️"
    : data.condition.includes("Mưa")
      ? "🌧️"
      : data.condition.includes("Giông")
        ? "⛈️"
        : "⛅";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <span className="text-4xl">{icon}</span>
        <div className="flex-1">
          <p style={{ color: "#D3DAD9" }} className="font-semibold text-lg">
            {data.city}
          </p>
          <p style={{ color: "#D3DAD9" }} className="text-2xl font-bold">
            {data.temperature}
            {data.unit}
          </p>
          <p style={{ color: "#9aa3a2" }} className="text-sm">
            {data.condition}
          </p>
        </div>
        <div className="text-right text-sm" style={{ color: "#9aa3a2" }}>
          <p>💧 {data.humidity}</p>
          <p>� {data.wind}</p>
        </div>
      </div>
      <SourceBadge {...source} />
    </div>
  );
}

function CurrencyCard({
  data,
  source,
}: {
  data: CurrencyResult;
  source: (typeof TOOL_SOURCE)[string];
}) {
  if (!data.success) return <p style={{ color: "#9aa3a2" }}>{data.error}</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-2xl">�</span>
        <div>
          <p style={{ color: "#D3DAD9" }} className="font-semibold text-lg">
            {data.amount.toLocaleString()} {data.from} ={" "}
            {data.result.toLocaleString()} {data.to}
          </p>
          <p style={{ color: "#9aa3a2" }} className="text-sm">
            1 {data.from} = {data.rate} {data.to}
          </p>
        </div>
      </div>
      <SourceBadge {...source} />
    </div>
  );
}

function DateTimeCard({
  data,
  source,
}: {
  data: DateTimeResult;
  source: (typeof TOOL_SOURCE)[string];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🕐</span>
        <div>
          <p style={{ color: "#D3DAD9" }} className="font-semibold text-lg">
            {data.time}
          </p>
          <p style={{ color: "#9aa3a2" }} className="text-sm">
            {data.date} · {data.timezone}
          </p>
        </div>
      </div>
      <SourceBadge {...source} />
    </div>
  );
}

function CalculatorCard({
  data,
  source,
}: {
  data: CalculatorResult;
  source: (typeof TOOL_SOURCE)[string];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🧮</span>
        <div>
          <p style={{ color: "#9aa3a2" }} className="text-sm font-mono">
            {data.expression} =
          </p>
          {data.success ? (
            <p
              style={{ color: "#D3DAD9" }}
              className="text-xl font-bold font-mono"
            >
              {data.result}
            </p>
          ) : (
            <p style={{ color: "#9aa3a2" }} className="text-sm">
              {data.error}
            </p>
          )}
        </div>
      </div>
      <SourceBadge {...source} />
    </div>
  );
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function SearchCard({
  data,
  source,
}: {
  data: SearchResult;
  source: (typeof TOOL_SOURCE)[string];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Favicon domain={source.domain} size={14} />
        <p style={{ color: "#9aa3a2" }} className="text-sm">
          Kết quả cho: <span style={{ color: "#D3DAD9" }}>{data.query}</span>
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {data.results.map((r, i) => {
          const domain = getDomain(r.url);
          return (
            <div
              key={i}
              style={{ background: "#37353E" }}
              className="px-3 py-2 rounded-lg"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {domain && <Favicon domain={domain} size={13} />}
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#D3DAD9" }}
                  className="font-medium text-sm hover:underline truncate"
                >
                  {r.title}
                </a>
              </div>
              <p style={{ color: "#9aa3a2" }} className="text-xs">
                {r.snippet}
              </p>
              {domain && (
                <p style={{ color: "#4a4852" }} className="text-xs mt-0.5">
                  {domain}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ToolCallCard({
  toolName,
  state,
  input,
  output,
}: ToolCallCardProps) {
  const isLoading = state === "input-available" || state === "input-streaming";
  const source = TOOL_SOURCE[toolName] ?? { domain: "", label: toolName };
  const label = TOOL_LABELS[toolName] ?? toolName;

  return (
    <div
      style={{ background: "#2e2c35", borderColor: "#4a4852" }}
      className="rounded-xl border px-4 py-3 my-1"
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          {source.domain && <Favicon domain={source.domain} size={14} />}
          <span style={{ color: "#9aa3a2" }} className="text-sm">
            {label}
            {Object.values(input)[0] != null && (
              <span style={{ color: "#D3DAD9" }}>
                {" "}
                — {String(Object.values(input)[0])}
              </span>
            )}
          </span>
          <LoadingDots />
        </div>
      ) : output ? (
        <>
          {toolName === "getWeather" && (
            <WeatherCard data={output as WeatherResult} source={source} />
          )}
          {toolName === "convertCurrency" && (
            <CurrencyCard data={output as CurrencyResult} source={source} />
          )}
          {toolName === "getCurrentDateTime" && (
            <DateTimeCard data={output as DateTimeResult} source={source} />
          )}
          {toolName === "calculator" && (
            <CalculatorCard data={output as CalculatorResult} source={source} />
          )}
          {toolName === "searchWeb" && (
            <SearchCard data={output as SearchResult} source={source} />
          )}
        </>
      ) : null}
    </div>
  );
}
