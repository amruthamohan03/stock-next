/**
 * The single way client components talk to this app's route handlers.
 *
 * Every handler answers `{ success, message, ... }`, but a bare
 * `await res.json()` only works while nothing goes wrong. A 500 that returns
 * Next's HTML error page, a dropped connection, or a session that expired into
 * a redirect all make it throw — and the caller is usually mid-`setSaving(true)`,
 * so the button sticks on "Saving…" for ever and the user is told nothing.
 *
 * `apiRequest` never throws. It always resolves to an ApiResult, so callers can
 * write one straight-line path: check `success`, show `message`.
 */

export type ApiResult<T = unknown> = {
  success: boolean;
  message: string;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  data?: T;
};

/** Messages for the failures that have no JSON body to read one from. */
const NETWORK_ERROR =
  "Could not reach the server. Check your connection and try again.";
const SESSION_EXPIRED = "Your session has expired. Please sign in again.";
const SERVER_ERROR = "Something went wrong on the server. Please try again.";

type Options = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiRequest<T = unknown>(
  url: string,
  options: Options = {}
): Promise<ApiResult<T>> {
  const { body, headers, ...rest } = options;

  // A FormData body must keep the browser's own multipart Content-Type.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: isForm ? headers : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    // Offline, DNS failure, CORS, request aborted — nothing was returned.
    return { success: false, message: NETWORK_ERROR, status: 0 };
  }

  // The middleware redirects an expired session to /login, which arrives here
  // as an HTML page — a far more useful message than "Unexpected token '<'".
  if (res.status === 401 || res.redirected) {
    return { success: false, message: SESSION_EXPIRED, status: res.status };
  }

  let json: Partial<ApiResult<T>> & Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    // A body that is not JSON (an HTML error page, or an empty 204).
    return {
      success: res.ok,
      message: res.ok ? "" : SERVER_ERROR,
      status: res.status,
    };
  }

  const message =
    typeof json.message === "string" && json.message
      ? json.message
      : res.ok
        ? ""
        : SERVER_ERROR;

  return {
    success: typeof json.success === "boolean" ? json.success : res.ok,
    message,
    status: res.status,
    data: json as T,
  };
}

/** Convenience wrappers — the verb is the common thing to get wrong. */
export const apiPost = <T = unknown>(url: string, body?: unknown) =>
  apiRequest<T>(url, { method: "POST", body });

export const apiPut = <T = unknown>(url: string, body?: unknown) =>
  apiRequest<T>(url, { method: "PUT", body });

export const apiPatch = <T = unknown>(url: string, body?: unknown) =>
  apiRequest<T>(url, { method: "PATCH", body });

export const apiDelete = <T = unknown>(url: string) =>
  apiRequest<T>(url, { method: "DELETE" });
