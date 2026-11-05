import { apiClient } from "@/lib/axios";
import type { Session, CreateSessionInput, UpdateSessionInput } from "./sessions.types";

export const sessionsApi = {
  getAll: async (signal?: AbortSignal): Promise<Session[]> => {
    const response = await apiClient.get<Session[]>("/sessions", { signal });
    return response.data;
  },

  getById: async (id: string, signal?: AbortSignal): Promise<Session> => {
    const response = await apiClient.get<Session>(`/sessions/${id}`, { signal });
    return response.data;
  },

  create: async (payload: CreateSessionInput): Promise<Session> => {
    const response = await apiClient.post<Session>("/sessions", payload);
    return response.data;
  },

  update: async (id: string, payload: UpdateSessionInput): Promise<Session> => {
    const response = await apiClient.put<Session>(`/sessions/${id}/update`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/sessions/${id}/delete`);
  },

  pin: async (id: string, isPinned: boolean): Promise<Session> => {
    const response = await apiClient.put<Session>(`/sessions/${id}/update`, { isPinned });
    return response.data;
  },
};
