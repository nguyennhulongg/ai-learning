import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi } from "./sessions.api";
import { sessionsKeys } from "./sessions.keys";
import type { CreateSessionInput, UpdateSessionInput } from "./sessions.types";

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSessionInput) => sessionsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: sessionsKeys.lists(),
      });
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSessionInput }) =>
      sessionsApi.update(id, payload),
    onSuccess: async (updatedSession) => {
      queryClient.setQueryData(sessionsKeys.detail(updatedSession.id), updatedSession);
      await queryClient.invalidateQueries({
        queryKey: sessionsKeys.lists(),
      });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({
        queryKey: sessionsKeys.detail(id),
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: sessionsKeys.lists(),
      });
    },
  });
}

export function usePinSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      sessionsApi.pin(id, isPinned),
    onSuccess: async (updatedSession) => {
      queryClient.setQueryData(sessionsKeys.detail(updatedSession.id), updatedSession);
      await queryClient.invalidateQueries({
        queryKey: sessionsKeys.lists(),
      });
    },
  });
}
