import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "./sessions.api";
import { sessionsKeys } from "./sessions.keys";

export function useSessions() {
  return useQuery({
    queryKey: sessionsKeys.list(),
    queryFn: ({ signal }) => sessionsApi.getAll(signal),
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: sessionsKeys.detail(id),
    queryFn: ({ signal }) => sessionsApi.getById(id, signal),
    enabled: Boolean(id),
  });
}
