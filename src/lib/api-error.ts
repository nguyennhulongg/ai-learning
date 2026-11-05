import axios from "axios";

export interface ApiError {
  message: string;
  code?: string;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiError>(error)) {
    return (
      error.response?.data?.message ??
      error.message ??
      "Request failed"
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred";
}
