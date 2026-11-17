/** Runtime checks for serverApiRequest inputs. */

import type { Tags } from "../types/api.types";

export const ALLOWED_METHODS = ["DELETE", "PATCH", "POST", "PUT"] as const;

export const ALLOWED_TAGS = [
  "location",
  "sighting",
  "user",
] as const satisfies readonly Tags[];

// Resolve a backend route to an absolute URL, or return null if the route is
// not a path or would leave the backend's origin (e.g. "@evil.com/x").
export function buildApiUrl(base: string, route: unknown): string | null {
  if (typeof route !== "string" || !route.startsWith("/")) return null;

  try {
    const url = new URL(base + route);
    if (url.origin !== new URL(base).origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isAllowedMethod(
  method: unknown,
): method is (typeof ALLOWED_METHODS)[number] {
  return (ALLOWED_METHODS as readonly unknown[]).includes(method);
}

// Keep only known cache tags; anything that isn't an array becomes [].
export function filterTags(tags: unknown): Tags[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is Tags =>
    (ALLOWED_TAGS as readonly unknown[]).includes(tag),
  );
}
