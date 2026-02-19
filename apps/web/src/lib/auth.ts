/**
 * Auth API client for the frontend.
 * Calls the auth microservice (distinct from the main API).
 *
 * SECURITY:
 * - Tokens are set/cleared by the auth service as httpOnly cookies
 * - Frontend NEVER reads or stores tokens
 * - credentials: "include" ensures cookies are sent
 */

const AUTH_URL = process.env["NEXT_PUBLIC_AUTH_URL"] ?? "http://localhost:3001";

async function authRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${AUTH_URL}/v1/auth${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const json = (await res.json()) as {
    status: string;
    data?: T;
    error?: { code: string; message: string };
  };
  if (!res.ok || json.status === "error") {
    throw new Error(json.error?.message ?? "Auth error");
  }
  return json.data as T;
}

export const authApi = {
  register: (email: string, password: string) =>
    authRequest("/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    authRequest("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => authRequest("/logout", { method: "POST" }),

  getMe: () => authRequest<{ id: string; email: string; role: string }>("/me"),

  refresh: () => authRequest("/refresh", { method: "POST" }),
};
