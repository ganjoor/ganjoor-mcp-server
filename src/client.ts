import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./constants.js";
import type { PagedList } from "./types.js";

/**
 * Error thrown for any non-2xx response or transport failure.
 * The message is already user-facing and actionable, so tool handlers can
 * surface it verbatim.
 */
export class GanjoorApiError extends Error {
  readonly status: number | null;
  readonly endpoint: string;

  constructor(message: string, status: number | null, endpoint: string) {
    super(message);
    this.name = "GanjoorApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export type QueryValue = string | number | boolean | undefined | null | Array<string | number>;

/**
 * Perform a GET request against the Ganjoor API.
 *
 * Array parameters are repeated (`?e=1&e=2`), matching ASP.NET Core binding.
 */
export async function ganjoorGet<T>(
  endpoint: string,
  params: Record<string, QueryValue> = {},
): Promise<T> {
  const url = buildUrl(endpoint, params);
  return request<T>(url, endpoint);
}

/** Perform a POST request with a JSON body (used by semantic search). */
export async function ganjoorPost<T>(
  endpoint: string,
  body: unknown,
  params: Record<string, QueryValue> = {},
): Promise<T> {
  const url = buildUrl(endpoint, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return await handleResponse<T>(response, endpoint);
  } catch (error) {
    if (error instanceof GanjoorApiError) throw error;
    throw toTransportError(error, endpoint);
  } finally {
    clearTimeout(timeout);
  }
}

function buildUrl(endpoint: string, params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const query = search.toString();
  return `${API_BASE_URL}${endpoint}${query ? `?${query}` : ""}`;
}

async function request<T>(url: string, endpoint: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    return await handleResponse<T>(response, endpoint);
  } catch (error) {
    if (error instanceof GanjoorApiError) throw error;
    throw toTransportError(error, endpoint);
  } finally {
    clearTimeout(timeout);
  }
}

async function handleResponse<T>(response: Response, endpoint: string): Promise<T> {
  const body = await response.text();

  if (!response.ok) {
    throw new GanjoorApiError(
      buildErrorMessage(response.status, body, endpoint),
      response.status,
      endpoint,
    );
  }

  if (!body.trim()) return [] as unknown as T;

  try {
    return JSON.parse(body) as T;
  } catch {
    // Upstream occasionally returns a bare string (e.g. /api/ganjoor/pageurl).
    return body as unknown as T;
  }
}

function buildErrorMessage(status: number, body: string, endpoint: string): string {
  // The API returns a 200-status body for some failures, and plain-text
  // exception dumps for 500s. Keep the first useful line only.
  const detail = extractDetail(body);

  switch (status) {
    case 400:
      return `Error: bad request for ${endpoint}.${detail ? ` ${detail}` : ""} Check that ids and filters are valid.`;
    case 401:
    case 403:
      return `Error: access denied for ${endpoint}. This resource requires a logged-in Ganjoor account; only public read endpoints are available here.`;
    case 404:
      return `Error: not found at ${endpoint}. Verify the id or URL slug — use ganjoor_list_poets or ganjoor_search_poems to find valid ones.`;
    case 429:
      return "Error: rate limited by api.ganjoor.net. Wait a few seconds and retry, and reduce the request rate.";
    default:
      if (status >= 500) {
        return `Error: Ganjoor API server error (${status}) for ${endpoint}.${detail ? ` ${detail}` : ""} This is usually an upstream bug — try a related endpoint or retry later.`;
      }
      return `Error: request to ${endpoint} failed with status ${status}.${detail ? ` ${detail}` : ""}`;
  }
}

function extractDetail(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") return truncate(parsed, 300);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      for (const key of ["title", "message", "error", "detail"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return truncate(value.trim(), 300);
      }
    }
  } catch {
    // Not JSON — fall through to the plain-text branch.
  }
  // Strip the .NET stack trace down to the exception message.
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  if (/^System\.\w+Exception/.test(firstLine)) return truncate(firstLine, 200);
  return truncate(firstLine, 300);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function toTransportError(error: unknown, endpoint: string): GanjoorApiError {
  if (error instanceof Error && error.name === "AbortError") {
    return new GanjoorApiError(
      `Error: request to ${endpoint} timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Retry, or narrow the request with pagination parameters.`,
      null,
      endpoint,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new GanjoorApiError(
    `Error: could not reach the Ganjoor API (${API_BASE_URL}) for ${endpoint}: ${message}. Check network connectivity and retry.`,
    null,
    endpoint,
  );
}

/** Convert any thrown value into an actionable message for the agent. */
export function toActionableError(error: unknown): string {
  if (error instanceof GanjoorApiError) return error.message;
  if (error instanceof Error) return `Error: ${error.message}`;
  return `Error: unexpected failure: ${String(error)}`;
}

/**
 * Normalize an upstream list into a consistent paginated envelope.
 *
 * The Ganjoor API uses 1-based `PageNumber` / `PageSize`. Some endpoints
 * (`/poets`, `/rhythms`) silently ignore those parameters and always return the
 * whole collection, so the requested page is sliced locally when the upstream
 * response is larger than the page size. That keeps `page`/`page_size`
 * meaningful and consistent across every list tool.
 */
export async function fetchPaged<T>(
  endpoint: string,
  page: number,
  pageSize: number,
  params: Record<string, QueryValue> = {},
): Promise<PagedList<T>> {
  const start = (page - 1) * pageSize;
  // Ask for one extra record to detect whether another page exists.
  const response = await ganjoorGet<T[]>(endpoint, {
    ...params,
    PageNumber: page,
    PageSize: pageSize + 1,
  });

  const list = Array.isArray(response) ? response : [];

  // Upstream ignored our paging window and handed back the full collection.
  const upstreamPaged = list.length <= pageSize + 1;
  const hasMore = upstreamPaged
    ? list.length > pageSize
    : start + pageSize < list.length;

  const items = upstreamPaged ? list.slice(0, pageSize) : list.slice(start, start + pageSize);

  return {
    items,
    page,
    page_size: pageSize,
    has_more: hasMore,
    next_page: hasMore ? page + 1 : null,
  };
}

/** Apply offset/itemCount style pagination (used by a few older endpoints). */
export function applySkipPaging<T>(
  all: T[],
  skip: number,
  itemsCount: number,
): { items: T[]; hasMore: boolean; nextSkip: number | null } {
  const windowed = all.slice(skip);
  const hasMore = itemsCount > 0 && windowed.length > itemsCount;
  return {
    items: hasMore ? windowed.slice(0, itemsCount) : windowed,
    hasMore,
    nextSkip: hasMore ? skip + itemsCount : null,
  };
}
