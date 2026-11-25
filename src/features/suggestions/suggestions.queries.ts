import { useQuery } from "@tanstack/react-query";
import { suggestionsApi } from "./suggestions.api";
import { suggestionsKeys } from "./suggestions.keys";

// Tải danh mục gợi ý một lần và giữ trong cache 5 phút.
// Danh mục chỉ đổi khi upload báo cáo mới, nên không cần tải lại thường xuyên.
export function useSuggestionCatalog() {
  return useQuery({
    queryKey: suggestionsKeys.catalog(),
    queryFn: ({ signal }) => suggestionsApi.getCatalog(signal),
    staleTime: 5 * 60_000,
  });
}
