"use server";

import CONFIG from "@/constants/config.constants";
import { getCookie } from "@/lib/session";
import type {
  ApiRequestInputs,
  ApiResponse,
  Headers,
  RequestHeaders,
} from "@/types/api.types";
import { ErrorMessages } from "@/types/error-messages.enum";
import type { UserWithCountAndBird } from "@/types/user.types";
import { revalidateTag } from "next/cache";

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
  const url = CONFIG.BASE_URL + route;

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
  if (tags?.length) requestHeaders.next = { tags };
  if (revalidateTime) requestHeaders.next = { revalidate: revalidateTime };
  if (Object.keys(headers).length) requestHeaders["headers"] = headers;

  const res = await fetch(url, requestHeaders);

  if (res.ok && revalidateTags?.length) {
    for (const tag of revalidateTags) {
      revalidateTag(tag);
    }
  }

  return res.json();
}

export async function exportSightingsCsv(): Promise<
  { error: true; message: string } | { error: false; csv: string }
> {
  const jwt = await getCookie();
  if (!jwt) return { error: true, message: ErrorMessages.InvalidSession };

  const res = await fetch(CONFIG.BASE_URL + "/users/export-data", {
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
