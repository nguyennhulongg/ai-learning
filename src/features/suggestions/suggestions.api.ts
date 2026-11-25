import { apiClient } from "@/lib/axios";
import type { SuggestionCatalog } from "./suggestions.types";

export const suggestionsApi = {
  getCatalog: async (signal?: AbortSignal): Promise<SuggestionCatalog> => {
    const response = await apiClient.get<SuggestionCatalog>("/suggestions/catalog", { signal });
    return response.data;
  },
};
