import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  // timeout: 15_000,
  headers: {
    Accept: "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Only set Content-Type for non-FormData requests
    if (!(config.data instanceof FormData)) {
      config.headers.setContentType('application/json');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

