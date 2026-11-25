export const suggestionsKeys = {
  all: ["suggestions"] as const,

  catalog: () => [...suggestionsKeys.all, "catalog"] as const,
};
