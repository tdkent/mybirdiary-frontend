"use server";

// Every export in this "use server" file is a server action the browser can
// call with any arguments. Check all inputs at runtime (see lib/api-url.ts),
// and keep helpers un-exported.

import CONFIG from "@/constants/config.constants";
import { buildApiUrl, filterTags, isAllowedMethod } from "@/lib/api-url";
import { getCookie } from "@/lib/session";
import * as Sentry from "@sentry/nextjs";
import type {
  ApiRequestInputs,
  ApiResponse,
  Headers,
  RequestHeaders,
} from "@/types/api.types";
import { ErrorMessages } from "@/types/error-messages.enum";
import type { UserWithCountAndBird } from "@/types/user.types";
import { revalidateTag } from "next/cache";

function badRequest(): ApiResponse<null> {
  return {
    count: null,
    data: null,
    error: true,
    message: ErrorMessages.BadRequest,
    statusCode: 400,
    timestamp: new Date().toISOString(),
  };
}

export async function getUser() {
  const res: ApiResponse<UserWithCountAndBird> = await serverApiRequest({
    route: "/users",
    tags: ["sighting", "user"],
  });
  return res;
}

export async function serverApiRequest({
  method,
  route,
  requestBody,
  revalidateTags,
  revalidateTime,
  tags,
}: ApiRequestInputs) {
  const url = buildApiUrl(CONFIG.BASE_URL, route);
  if (!url) {
    Sentry.logger.warn("serverApiRequest rejected an invalid route");
    return badRequest();
  }
  if (method !== undefined && !isAllowedMethod(method)) {
    Sentry.logger.warn("serverApiRequest rejected an invalid method");
    return badRequest();
  }

  const fetchTags = filterTags(tags);
  const tagsToRevalidate = filterTags(revalidateTags);

  const requestHeaders: RequestHeaders = {};
  const headers: Headers = {};

  if (!method) requestHeaders.cache = "force-cache";

  const jwt = await getCookie();

  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (method) requestHeaders.method = method;
  if (requestBody) {
    headers["Content-Type"] = "application/json";
    requestHeaders.body = JSON.stringify(requestBody);
  }
  if (fetchTags.length) requestHeaders.next = { tags: fetchTags };
  if (
    typeof revalidateTime === "number" &&
    Number.isFinite(revalidateTime) &&
    revalidateTime > 0
  ) {
    requestHeaders.next = { revalidate: revalidateTime };
  }
  if (Object.keys(headers).length) requestHeaders["headers"] = headers;

  const res = await fetch(url, requestHeaders);

  if (res.ok) {
    for (const tag of tagsToRevalidate) {
      revalidateTag(tag);
    }
  }

  return res.json();
}

export async function exportSightingsCsv(): Promise<
  { error: true; message: string } | { error: false; csv: string }
> {
  const url = buildApiUrl(CONFIG.BASE_URL, "/users/export-data");
  if (!url) return { error: true, message: ErrorMessages.Unexpected };

  const jwt = await getCookie();
  if (!jwt) return { error: true, message: ErrorMessages.InvalidSession };

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!res.ok) {
    try {
      const result: ApiResponse<null> = await res.json();
      return { error: true, message: result.message };
    } catch {
      return { error: true, message: ErrorMessages.Unexpected };
    }
  }

  return { error: false, csv: await res.text() };
}
