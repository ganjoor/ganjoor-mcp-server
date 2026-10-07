import { z } from "zod";
import { MAX_PAGE_SIZE } from "./constants.js";

/** Output format selector shared by every tool. */
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe(
    "Output format: 'markdown' for human-readable text (default) or 'json' for machine-readable structured data.",
  );

/** Standard 1-based page / page-size pair with the API's hard cap applied. */
export const PaginationSchema = z.object({
  page: z
    .number()
    .int()
    .min(1)
    .max(10_000)
    .default(1)
    .describe("Page number, starting from 1."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(20)
    .describe(`Maximum items to return per page (1-${MAX_PAGE_SIZE}, default 20).`),
});

/** Reusable page / page_size shapes for composition into larger schemas. */
export const PageField = PaginationSchema.shape.page;
export const PageSizeField = PaginationSchema.shape.page_size;

/**
 * A Ganjoor URL slug such as "hafez/ghazal/sh494".
 *
 * The upstream API requires the leading slash on its `url` query parameter —
 * `?url=hafez/ghazal/sh494` 404s while `?url=/hafez/ghazal/sh494` resolves — so
 * this normalizes to that form and tolerates agents passing either.
 */
export const UrlSlugSchema = z
  .string()
  .trim()
  .min(1, "URL must not be empty")
  .max(300, "URL must not exceed 300 characters")
  .regex(
    /^\/?[A-Za-z0-9آ-ی؀-ۿ‌._~%\-/]+$/u,
    "URL may only contain letters, digits, '-', '_', '.', '%', '/' and Persian characters",
  )
  .describe(
    "Ganjoor URL slug. Examples: 'hafez/ghazal/sh494', '/hafez/ghazal/sh494', 'mowhaddam/ghazal/ha1'. The leading slash is optional.",
  )
  .transform((value) => `/${value.replace(/^\/+/, "")}`);

export const IdSchema = z
  .number()
  .int()
  .positive("Id must be a positive integer")
  .describe("Numeric Ganjoor record id (poet, category, poem, person, ...).");

export const PoetIdSchema = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Poet id. Use 0 for 'all poets' where the endpoint supports it. Hafez is 2, Saadi is 7, Rumi is 5, Khayyam is 3.");

export const CatIdSchema = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Category id (a book or section inside a poet's work). Use 0 for 'all categories' where supported.");

/** Booleans the upstream API expects as `true`/`false` strings. */
export const BoolFlag = (description: string, defaultValue = false) =>
  z.boolean().default(defaultValue).describe(description);
