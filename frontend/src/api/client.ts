import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export const client = axios.create({ baseURL: BASE_URL });

/**
 * Single in-flight refresh, shared by every caller. After a page reload the
 * persisted session has a refresh token but no access token, and the app
 * fires many requests at once — without this they would all 401 and race
 * their own refresh calls. Uses plain axios so it never recurses through
 * these interceptors.
 */
let refreshPromise: Promise<string> | null = null;
const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    const { refreshToken } = useAuthStore.getState();
    refreshPromise = axios
      .post<{ accessToken: string }>(`${BASE_URL}/auth/refresh`, { refreshToken })
      .then(({ data }) => {
        useAuthStore.getState().setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Attach the access token to every request — minting one first (before the
// request leaves) when only the persisted refresh token is available.
client.interceptors.request.use(async (config) => {
  const state = useAuthStore.getState();
  let { accessToken } = state;
  if (!accessToken && state.refreshToken) {
    try {
      accessToken = await refreshAccessToken();
    } catch {
      // fall through: the request goes out unauthenticated and the
      // response interceptor's failure path cleans up the session
    }
  }
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// On 401 (e.g. the access token expired mid-session): attempt ONE silent
// refresh, then retry the original request. If the refresh itself fails,
// clear auth (including the persisted session) and send the user to /login.
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const { refreshToken, clearAuth } = useAuthStore.getState();

    const isRefreshCall = original?.url?.includes('/auth/refresh');
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !isRefreshCall &&
      refreshToken
    ) {
      original._retried = true;
      try {
        const accessToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return client(original);
      } catch {
        clearAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Extracts the backend's plain-language error message from any API error. */
export const getApiError = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (!err.response) return 'Cannot reach the server. Please try again.';
  }
  return 'Something went wrong. Please try again.';
};
