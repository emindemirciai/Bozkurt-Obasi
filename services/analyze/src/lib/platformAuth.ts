export const PLATFORM_AUTH_TIMEOUT_MS = 8_000;

export type PlatformAuthError =
  | "admin_unavailable"
  | "auth_api_unavailable"
  | "invalid_credentials"
  | "admin_session_required"
  | "access_denied"
  | "login_rate_limited";

export type PlatformAuthFailure = {
  ok: false;
  status: number;
  error: PlatformAuthError;
};

type AdminSession = { email: string; expiresAt: number };
type AuthOptions = { fetcher?: typeof fetch; timeoutMs?: number; now?: number };
type AuthResponse = { response: Response; data: unknown } | PlatformAuthFailure;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unavailable(): PlatformAuthFailure {
  return { ok: false, status: 503, error: "auth_api_unavailable" };
}

async function requestAuth(
  url: string,
  init: RequestInit,
  options: AuthOptions,
): Promise<AuthResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? PLATFORM_AUTH_TIMEOUT_MS,
  );
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      redirect: "error",
    });
    const data: unknown = await response.json().catch(() => null);
    return { response, data };
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timeout);
  }
}

function rejected(
  response: Response,
  data: unknown,
  phase: "login" | "session",
): PlatformAuthFailure {
  if (response.status === 503 && object(data) && data.error === "admin_unavailable") {
    return { ok: false, status: 503, error: "admin_unavailable" };
  }
  if (response.status === 429) {
    return { ok: false, status: 429, error: "login_rate_limited" };
  }
  if (response.status === 401) {
    return {
      ok: false,
      status: 401,
      error: phase === "login" ? "invalid_credentials" : "admin_session_required",
    };
  }
  if (response.status === 403) {
    return { ok: false, status: 403, error: "access_denied" };
  }
  if (response.status === 400 && object(data) && data.error === "invalid_credentials") {
    return { ok: false, status: 400, error: "invalid_credentials" };
  }
  return unavailable();
}

export async function verifyPlatformAdminSession(
  authApiUrl: string,
  token: string,
  options: AuthOptions = {},
): Promise<{ ok: true; session: AdminSession } | PlatformAuthFailure> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { ok: false, status: 401, error: "admin_session_required" };
  }
  const result = await requestAuth(
    `${authApiUrl}/api/admin/session`,
    { headers: { Authorization: `Bearer ${token}` } },
    options,
  );
  if ("ok" in result) return result;
  if (result.response.status !== 200) {
    return rejected(result.response, result.data, "session");
  }
  const session = result.data;
  if (
    !object(session)
    || typeof session.email !== "string"
    || !session.email.trim()
    || session.email.length > 254
    || typeof session.expiresAt !== "number"
    || !Number.isFinite(session.expiresAt)
    || session.expiresAt <= (options.now ?? Date.now())
  ) {
    return unavailable();
  }
  return { ok: true, session: { email: session.email, expiresAt: session.expiresAt } };
}

export async function signInPlatformAdmin(
  authApiUrl: string,
  email: string,
  password: string,
  options: AuthOptions = {},
): Promise<{ ok: true; token: string; session: AdminSession } | PlatformAuthFailure> {
  const result = await requestAuth(
    `${authApiUrl}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    options,
  );
  if ("ok" in result) return result;
  if (result.response.status !== 200) {
    return rejected(result.response, result.data, "login");
  }
  if (
    !object(result.data)
    || typeof result.data.token !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(result.data.token)
  ) {
    return unavailable();
  }
  const verified = await verifyPlatformAdminSession(authApiUrl, result.data.token, options);
  if (verified.ok === false) return verified;
  if (verified.session.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return unavailable();
  }
  return { ok: true, token: result.data.token, session: verified.session };
}
