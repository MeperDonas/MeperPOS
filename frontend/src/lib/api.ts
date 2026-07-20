import axios, { AxiosInstance, AxiosError } from "axios";
import { safeGetItem, safeRemoveItem } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

type ApiErrorData = {
  message?: string | string[];
  error?: string | { message?: string | string[] };
  errors?: Array<{ message?: string }>;
};

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

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = safeGetItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        if (typeof window !== "undefined") {
          const orgId = localStorage.getItem("selectedOrganizationId");
          if (orgId) {
            config.headers["X-Organization-Id"] = orgId;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          safeRemoveItem("token");
          safeRemoveItem("user");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );
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
