export const sessionsKeys = {
  all: ["sessions"] as const,

  lists: () => [...sessionsKeys.all, "list"] as const,

  list: () => [...sessionsKeys.lists()] as const,

  details: () => [...sessionsKeys.all, "detail"] as const,

  detail: (id: string) => [...sessionsKeys.details(), id] as const,
};
