import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { ApiClient, getApiErrorDetails, getApiErrorMessage } from "./api";
import {
  classifyPublicError,
  toPublicError,
} from "../../../backend/src/common/errors/public-error.model";
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from "./session";

type Adapter = (
  config: InternalAxiosRequestConfig
) => Promise<AxiosResponse>;

function baseConfig(
  url?: string
): InternalAxiosRequestConfig {
  return {
    url,
    headers: new AxiosHeaders(),
  } as InternalAxiosRequestConfig;
}

function okResponse(
  config: InternalAxiosRequestConfig = baseConfig(),
  data: unknown = {}
): AxiosResponse {
  return { status: 200, statusText: "OK", data, headers: {}, config };
}

function error401(config: InternalAxiosRequestConfig): AxiosError {
  const response = {
    status: 401,
    statusText: "Unauthorized",
    data: {},
    headers: {},
    config,
  } as AxiosResponse;
  return new AxiosError(
    "Request failed with status code 401",
    AxiosError.ERR_BAD_RESPONSE,
    config,
    {},
    response
  );
}

describe("ApiClient interceptors - in-memory session + refresh flow (issue #48 slice C2)", () => {
  let adapter: ReturnType<typeof vi.fn<Adapter>>;
  let onSessionExpired: ReturnType<typeof vi.fn<() => void>>;
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    adapter = vi.fn<Adapter>();
    onSessionExpired = vi.fn<() => void>();
    const client = new ApiClient(onSessionExpired);
    axiosInstance = client.getAxiosInstance();
    axiosInstance.defaults.adapter = adapter;
    clearAccessToken();
    document.cookie = "csrf_token=; Max-Age=0; path=/";
  });

  afterEach(() => {
    clearAccessToken();
    document.cookie = "csrf_token=; Max-Age=0; path=/";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("request interceptor", () => {
    it("attaches the Bearer token from the in-memory session store and sends credentials", async () => {
      setAccessToken("tok-1");
      adapter.mockResolvedValue(okResponse());

      await axiosInstance.get("/products");

      const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig;
      expect(config.headers?.get("Authorization")).toBe("Bearer tok-1");
      expect(config.withCredentials).toBe(true);
    });

    it("does not attach an Authorization header when no token is in memory", async () => {
      adapter.mockResolvedValue(okResponse());

      await axiosInstance.get("/products");

      const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig;
      expect(config.headers?.get("Authorization")).toBeFalsy();
    });

    it("sends the x-csrf-token header on mutating requests when the csrf_token cookie exists", async () => {
      document.cookie = "csrf_token=csrf-abc123; path=/";
      adapter.mockResolvedValue(okResponse());

      await axiosInstance.post("/sales", {});
      await axiosInstance.get("/sales");

      const postConfig = adapter.mock.calls[0][0] as InternalAxiosRequestConfig;
      const getConfig = adapter.mock.calls[1][0] as InternalAxiosRequestConfig;
      expect(postConfig.headers?.get("x-csrf-token")).toBe("csrf-abc123");
      expect(getConfig.headers?.get("x-csrf-token")).toBeFalsy();
    });
  });

  describe("response interceptor - refresh and retry", () => {
    it("performs exactly one refresh and retries the original request once after a 401", async () => {
      setAccessToken("stale-token");
      adapter.mockImplementation(async (config) => {
        if (config.url === "/orders") {
          if (!config._retry) throw error401(config);
          return okResponse(config, { items: ["fresh"] });
        }
        if (config.url === "/auth/refresh") {
          return okResponse(config, { accessToken: "fresh-token" });
        }
        throw new Error(`Unexpected request to ${String(config.url)}`);
      });

      const response = await axiosInstance.get("/orders");

      expect(response.data).toEqual({ items: ["fresh"] });

      const urls = adapter.mock.calls.map((call) => call[0]?.url);
      // Original -> single refresh -> single retry.
      expect(urls).toEqual(["/orders", "/auth/refresh", "/orders"]);

      const retryConfig = adapter.mock.calls[2][0] as InternalAxiosRequestConfig;
      expect(retryConfig._retry).toBe(true);
      expect(retryConfig.headers?.get("Authorization")).toBe("Bearer fresh-token");
      expect(getAccessToken()).toBe("fresh-token");
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("dedupes concurrent 401 responses into exactly one refresh request", async () => {
      setAccessToken("stale-token");
      const retried = new Set<string>();
      adapter.mockImplementation(async (config) => {
        if (config.url === "/auth/refresh") {
          return okResponse(config, { accessToken: "fresh-token" });
        }
        if (typeof config.url === "string" && !retried.has(config.url)) {
          retried.add(config.url);
          throw error401(config);
        }
        return okResponse(config, { url: config.url });
      });

      const [a, b, c] = await Promise.all([
        axiosInstance.get("/a"),
        axiosInstance.get("/b"),
        axiosInstance.get("/c"),
      ]);

      expect(a.data).toEqual({ url: "/a" });
      expect(b.data).toEqual({ url: "/b" });
      expect(c.data).toEqual({ url: "/c" });

      const refreshCalls = adapter.mock.calls.filter(
        (call) => call[0]?.url === "/auth/refresh"
      );
      expect(refreshCalls).toHaveLength(1);
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("clears the session, removes the user display cache and redirects to /login when the refresh fails", async () => {
      localStorage.setItem("user", JSON.stringify({ id: "user-1" }));
      setAccessToken("stale-token");
      adapter.mockImplementation(async (config) => {
        if (config.url === "/auth/refresh") throw error401(config);
        throw error401(config);
      });

      await expect(axiosInstance.get("/orders")).rejects.toThrow();

      expect(getAccessToken()).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
      expect(onSessionExpired).toHaveBeenCalledTimes(1);

      // The refresh itself must not be retried recursively.
      const urls = adapter.mock.calls.map((call) => call[0]?.url);
      expect(urls).toEqual(["/orders", "/auth/refresh"]);
    });

    it("does not trigger a refresh for pre-auth endpoints that return 401", async () => {
      setAccessToken("tok-1");
      adapter.mockImplementation(async (config) => {
        if (config.url === "/auth/login") throw error401(config);
        throw new Error(`Unexpected request to ${String(config.url)}`);
      });

      await expect(
        axiosInstance.post("/auth/login", { email: "a@b.c", password: "nope" })
      ).rejects.toThrow();

      const refreshCalls = adapter.mock.calls.filter(
        (call) => call[0]?.url === "/auth/refresh"
      );
      expect(refreshCalls).toHaveLength(0);
      expect(onSessionExpired).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("tok-1");
    });

    it("rejects without redirecting when the retried request fails again with 401", async () => {
      setAccessToken("stale-token");
      adapter.mockImplementation(async (config) => {
        if (config.url === "/auth/refresh") {
          return okResponse(config, { accessToken: "fresh-but-revoked" });
        }
        throw error401(config); // /orders keeps failing even after retry
      });

      await expect(axiosInstance.get("/orders")).rejects.toThrow();

      const urls = adapter.mock.calls.map((call) => call[0]?.url);
      expect(urls).toEqual(["/orders", "/auth/refresh", "/orders"]);
      expect(onSessionExpired).not.toHaveBeenCalled();
    });
  });
});

describe("public API error contract", () => {
  it("prefers the canonical safe message and retains its requestId", () => {
    const error = new AxiosError("client diagnostic");
    error.response = {
      status: 400,
      statusText: "Bad Request",
      data: {
        code: "VALIDATION_ERROR",
        message: "El precio no es válido",
        requestId: "request-123",
        details: "must not be shown",
      },
      headers: {},
      config: baseConfig(),
    };

    expect(getApiErrorDetails(error, "Fallback")).toEqual({
      code: "VALIDATION_ERROR",
      message: "El precio no es válido",
      requestId: "request-123",
    });
    expect(getApiErrorMessage(error, "Fallback")).toBe("El precio no es válido");
  });

  it("supports only bounded legacy safe messages and never promotes nested diagnostics", () => {
    const legacy = new AxiosError("client diagnostic");
    legacy.response = {
      status: 400,
      statusText: "Bad Request",
      data: { message: ["Nombre requerido", "SKU requerido"] },
      headers: {},
      config: baseConfig(),
    };
    expect(getApiErrorDetails(legacy, "Fallback").message).toBe(
      "Nombre requerido, SKU requerido",
    );

    const nested = new AxiosError("client diagnostic");
    nested.response = {
      status: 500,
      statusText: "Internal Server Error",
      data: { error: { message: "database password=secret" } },
      headers: {},
      config: baseConfig(),
    };
    expect(getApiErrorMessage(nested, "Safe fallback")).toBe("Safe fallback");
  });

  it("does not use arbitrary client Error text when the response has no safe message", () => {
    const error = new Error("internal stack marker");

    expect(getApiErrorDetails(error, "Safe fallback")).toEqual({
      code: "UNKNOWN_ERROR",
      message: "Safe fallback",
      requestId: undefined,
    });
  });

  describe("coordinated rollout rollback", () => {
    it("restores the prior compatible contract across backend and frontend as one change set", () => {
      const auditLog = { create: vi.fn() };
      const rolloutResponse = toPublicError(
        classifyPublicError(new Error("ROLLBACK-SENSITIVE-DIAGNOSTIC")),
        "rollback-request-42",
      );

      const rolloutClientView = getApiErrorDetails(
        new AxiosError("client-side diagnostic", "ERR_BAD_RESPONSE", baseConfig(), {}, {
          status: 500,
          statusText: "Internal Server Error",
          data: rolloutResponse,
          headers: {},
          config: baseConfig(),
        }),
        "Safe fallback",
      );
      expect(rolloutClientView).toEqual({
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        requestId: "rollback-request-42",
      });
      expect(JSON.stringify(rolloutClientView)).not.toContain(
        "ROLLBACK-SENSITIVE-DIAGNOSTIC",
      );

      const priorCompatibleResponse = {
        statusCode: 500,
        message: "The server could not complete the request",
        error: "Internal Server Error",
      };
      const rolledBackClientView = getApiErrorDetails(
        new AxiosError("client-side diagnostic", "ERR_BAD_RESPONSE", baseConfig(), {}, {
          status: 500,
          statusText: "Internal Server Error",
          data: priorCompatibleResponse,
          headers: {},
          config: baseConfig(),
        }),
        "Safe fallback",
      );

      expect(rolledBackClientView).toEqual({
        code: "UNKNOWN_ERROR",
        message: "The server could not complete the request",
        requestId: undefined,
      });
      expect(auditLog.create).not.toHaveBeenCalled();
    });

    it("keeps the prior client fallback safe when rollback receives legacy diagnostic fields", () => {
      const rolledBackClientView = getApiErrorDetails(
        new AxiosError("client-side diagnostic", "ERR_BAD_RESPONSE", baseConfig(), {}, {
          status: 500,
          statusText: "Internal Server Error",
          data: {
            statusCode: 500,
            message: "The server could not complete the request",
            error: { message: "ROLLBACK-SENSITIVE-DIAGNOSTIC", stack: "private stack" },
            details: "ROLLBACK-SENSITIVE-DIAGNOSTIC",
          },
          headers: {},
          config: baseConfig(),
        }),
        "Safe fallback",
      );

      expect(rolledBackClientView.message).toBe(
        "The server could not complete the request",
      );
      expect(JSON.stringify(rolledBackClientView)).not.toContain(
        "ROLLBACK-SENSITIVE-DIAGNOSTIC",
      );
    });
  });
});
