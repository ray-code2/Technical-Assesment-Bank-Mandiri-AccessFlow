const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "accessflow_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body.error ?? {};
    if (response.status === 401 && path !== "/auth/login") {
      setToken(null);
      window.dispatchEvent(new Event("accessflow:unauthorized"));
    }
    throw new ApiError(error.message ?? "Request failed", response.status, error.code ?? "UNKNOWN");
  }
  return body as T;
}

