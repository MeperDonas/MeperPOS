import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { safeRemoveItem } from "@/lib/utils";
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from "@/lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
const USER_DISPLAY_CACHE_KEY = "user";
const LOGIN_PATH = "/login";

/** Endpoints that must never trigger the refresh flow (they are pre-auth or own the session lifecycle). */
const AUTH_EXCLUDED_URLS = new Set([
  "/auth/login",
  "/auth/select-organization",
  "/auth/refresh",
  "/auth/logout",
]);

type ApiErrorData = {
  message?: string | string[];
  error?: string | { message?: string | string[] };
  errors?: Array<{ message?: string }>;
};

/**
 * Auth responses keep returning tokens in the JSON body (dual-mode backend)
 * while also setting httpOnly cookies. Only the access token is consumed
 * here; it goes straight to the in-memory session store.
 */
interface AuthTokenResponse {
  accessToken?: string;
  /** Legacy alias still accepted by some endpoints. */
  token?: string;
  refreshToken?: string;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorData | undefined;

    const nestedErrorMessage =
      typeof data?.error === "object" && data?.error !== null
        ? data.error.message
        : undefined;

    const message = data?.message ?? nestedErrorMessage;

    if (Array.isArray(message)) {
      return message.join(", ");
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }

    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const firstError = data.errors[0]?.message;
      if (typeof firstError === "string" && firstError.trim()) {
        return firstError;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

// Custom per-request flags used by the refresh-and-retry flow.
// InternalAxiosRequestConfig extends this interface, so both sides get the flags.
declare module "axios" {
  export interface AxiosRequestConfig {
    _retry?: boolean;
    _isRefreshCall?: boolean;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function defaultOnSessionExpired(): void {
  if (typeof window !== "undefined") {
    window.location.href = LOGIN_PATH;
  }
}

export class ApiClient {
  private client: AxiosInstance;

  /** Promise shared by concurrent 401s so only ONE /auth/refresh runs at a time. */
  private refreshInProgress: Promise<string | null> | null = null;

  constructor(
    private readonly onSessionExpired: () => void = defaultOnSessionExpired
  ) {
    this.client = axios.create({
      baseURL: API_URL,
      // Cookies (access/refresh/csrf) must flow on every request, including
      // cross-site calls to the API host.
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        // Access token lives in memory only.
        const token = getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        if (typeof window !== "undefined") {
          const orgId = localStorage.getItem("selectedOrganizationId");
          if (orgId) {
            config.headers["X-Organization-Id"] = orgId;
          }
          // Defense-in-depth: send the readable CSRF cookie value on mutating
          // requests. Harmless alongside Bearer (the backend CSRF guard only
          // enforces when no Bearer header is present).
          if (
            config.method &&
            ["post", "put", "patch", "delete"].includes(config.method)
          ) {
            const csrfToken = readCookie("csrf_token");
            if (csrfToken) {
              config.headers["x-csrf-token"] = csrfToken;
            }
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const config = error.config;

        if (
          error.response?.status !== 401 ||
          !config ||
          config._retry ||
          config._isRefreshCall ||
          AUTH_EXCLUDED_URLS.has(config.url ?? "")
        ) {
          return Promise.reject(error);
        }

        return this.refreshSession().then((newToken) => {
          if (!newToken) {
            // Refresh failed — the session is definitively dead.
            safeRemoveItem(USER_DISPLAY_CACHE_KEY);
            this.onSessionExpired();
            return Promise.reject(error);
          }
          // Retry the original request exactly once with the fresh token.
          // The request interceptor picks up the new Bearer automatically.
          config._retry = true;
          return this.client.request(config);
        });
      }
    );
  }

  /**
   * POST /auth/refresh using the httpOnly refresh_token cookie.
   * Concurrent callers share a single in-flight promise (dedupe).
   * Resolves with the new access token, or null when the refresh failed.
   */
  private refreshSession(): Promise<string | null> {
    if (!this.refreshInProgress) {
      const refreshPromise = this.client
        .post<AuthTokenResponse>(
          "/auth/refresh",
          {},
          { _isRefreshCall: true }
        )
        .then((response) => {
          const token =
            response.data.accessToken ??
            response.data.token ??
            null;
          if (token) {
            setAccessToken(token);
            return token;
          }
          clearAccessToken();
          return null;
        })
        .catch(() => {
          clearAccessToken();
          return null;
        })
        .finally(() => {
          this.refreshInProgress = null;
        });

      this.refreshInProgress = refreshPromise;
    }
    return this.refreshInProgress;
  }

  /** Internal axios instance. Exposed for tests only — do not use in app code. */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }

  get<T = unknown>(url: string, params?: Record<string, unknown>) {
    return this.client.get<T>(url, { params });
  }

  post<T = unknown>(url: string, data?: unknown) {
    return this.client.post<T>(url, data);
  }

  postWithFormData<T = unknown>(url: string, data: FormData) {
    return this.client.post<T>(url, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  put<T = unknown>(url: string, data?: unknown) {
    return this.client.put<T>(url, data);
  }

  patch<T = unknown>(url: string, data?: unknown) {
    return this.client.patch<T>(url, data);
  }

  delete<T = unknown>(url: string, config?: Record<string, unknown>) {
    return this.client.delete<T>(url, config);
  }

  upload<T = unknown>(url: string, file: File) {
    const formData = new FormData();
    formData.append("image", file);
    return this.client.post<T>(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  async exportData(url: string, data?: unknown) {
    const response = await this.client.post(url, data, {
      responseType: "blob",
    });

    this.downloadBlobResponse(response.data, response.headers);
  }

  async downloadData(url: string, params?: Record<string, unknown>) {
    const response = await this.client.get(url, {
      params,
      responseType: "blob",
    });

    this.downloadBlobResponse(response.data, response.headers);
  }

  private downloadBlobResponse(
    blobData: BlobPart,
    headers: Record<string, unknown>
  ) {
    const contentType =
      typeof headers["content-type"] === "string"
        ? headers["content-type"]
        : undefined;
    let filename = `export_${Date.now()}`;

    const contentDisposition =
      typeof headers["content-disposition"] === "string"
        ? headers["content-disposition"]
        : undefined;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    const url_blob = window.URL.createObjectURL(new Blob([blobData], { type: contentType }));
    const link = document.createElement("a");
    link.href = url_blob;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url_blob);
  }
}

export const api = new ApiClient();
