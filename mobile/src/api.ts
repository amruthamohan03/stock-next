import * as SecureStore from "expo-secure-store";

/**
 * Talking to the stock server.
 *
 * This is the phone's copy of the web app's `src/lib/api-client.ts` contract:
 * a request never throws, it always resolves to `{ success, message, status }`
 * with a message worth showing. On a LAN that matters more than on the web —
 * the server is someone's PC, and it is routinely off, asleep or on a
 * different Wi-Fi than the phone.
 */
export type ApiResult<T = unknown> = {
  success: boolean;
  message: string;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  data?: T;
};

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  roleId: number;
  roleName: string;
  profileImage?: string | null;
};

const TOKEN_KEY = "stock.token";
const SERVER_KEY = "stock.server";

/** Where the dev/office server usually lives; the login screen can change it. */
export const DEFAULT_SERVER = "http://192.168.0.138:3001";

/** Requests give up after this long — a dead LAN host otherwise hangs for ~75s. */
const TIMEOUT_MS = 12_000;

let serverUrl = DEFAULT_SERVER;
let token: string | null = null;

export function getServerUrl() {
  return serverUrl;
}

export async function setServerUrl(url: string) {
  serverUrl = normalizeServer(url);
  await SecureStore.setItemAsync(SERVER_KEY, serverUrl);
}

/** "192.168.0.138:3001/" → "http://192.168.0.138:3001" */
export function normalizeServer(input: string) {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_SERVER;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function getToken() {
  return token;
}

async function setToken(value: string | null) {
  token = value;
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Load the saved server + token at launch. */
export async function restore() {
  const [savedServer, savedToken] = await Promise.all([
    SecureStore.getItemAsync(SERVER_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
  ]);
  if (savedServer) serverUrl = savedServer;
  token = savedToken;
  return { serverUrl, token };
}

const NETWORK_ERROR =
  "Can't reach the server. Check the Wi-Fi, the server address, and that the server is running.";
const TIMEOUT_ERROR = "The server took too long to answer. Is it awake?";
const SESSION_EXPIRED = "Your session has expired. Please sign in again.";
const SERVER_ERROR = "Something went wrong on the server. Please try again.";

export async function apiRequest<T = unknown>(
  path: string,
  options: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<ApiResult<T>> {
  const { body, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${serverUrl}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    return { success: false, message: aborted ? TIMEOUT_ERROR : NETWORK_ERROR, status: 0 };
  } finally {
    clearTimeout(timer);
  }

  let json: (Partial<ApiResult<T>> & Record<string, unknown>) | null = null;
  try {
    json = await res.json();
  } catch {
    // Not JSON — an HTML error page, or an empty body.
  }

  if (res.status === 401) {
    return {
      success: false,
      message: (json?.message as string) || SESSION_EXPIRED,
      status: 401,
    };
  }

  const message =
    typeof json?.message === "string" && json.message
      ? json.message
      : res.ok
        ? ""
        : SERVER_ERROR;

  return {
    success: typeof json?.success === "boolean" ? json.success : res.ok,
    message,
    status: res.status,
    data: (json ?? undefined) as T,
  };
}

export const apiGet = <T = unknown>(path: string) => apiRequest<T>(path);
export const apiPost = <T = unknown>(path: string, body?: unknown) =>
  apiRequest<T>(path, { method: "POST", body });

/* ------------------------------------------------------------------ auth */

export async function login(username: string, password: string) {
  const result = await apiRequest<{ token: string; user: SessionUser }>(
    "/api/auth/login",
    { method: "POST", body: { username, password, rememberMe: true } }
  );
  if (result.success && result.data?.token) {
    await setToken(result.data.token);
  }
  return result;
}

export async function logout() {
  await setToken(null);
}

/** Validate a restored token on launch; null means "show the login screen". */
export async function currentUser(): Promise<SessionUser | null> {
  if (!token) return null;
  const result = await apiGet<{ user: SessionUser }>("/api/auth/me");
  if (!result.success) {
    if (result.status === 401) await setToken(null);
    return null;
  }
  return result.data?.user ?? null;
}

/* ----------------------------------------------------------------- stock */

export type StockRow = {
  id: number;
  transaction_date: string;
  item_name: string | null;
  location: string | null;
  transaction_type: string;
  receipt_qty: number | null;
  issue_qty: number | null;
  balance_qty: number | null;
  item_status: string | null;
  to_name: string | null;
  from_name: string | null;
  remarks: string | null;
};

export type StockPage = {
  rows: StockRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export function fetchStock(search: string, page: number, pageSize = 20) {
  const q = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize) });
  return apiGet<StockPage>(`/api/stock?${q.toString()}`);
}

export type Opt = { id: number; name: string };
export type ItemOpt = { key: string; name: string; has_ledger: boolean; group_id: number | null };
export type StockOptions = {
  stockBooks: ItemOpt[];
  groups: Opt[];
  departments: Opt[];
  registers: (Opt & { book_no: number | null; volume: string | null })[];
  locations: Opt[];
  indentBooks: (Opt & { book_no: number | null })[];
};

export const fetchStockOptions = () => apiGet<StockOptions>("/api/stock/options");

export type NewStockEntry = {
  stock_book_id: string;
  new_location_id?: number | string;
  department_id: number | string;
  transaction_type: string;
  transaction_date: string;
  qty: string | number;
  stock_book_master_id?: number | string;
  stock_book_page_no?: string;
  issued_to_location_id?: number | string;
  item_status?: string;
  remarks?: string;
};

export const createStockEntry = (entry: NewStockEntry) => apiPost("/api/stock", entry);
