"use server";

import { getUser } from "@/actions/api.actions";
import { decrypt, getCookie } from "@/lib/session";

export async function checkSession() {
  const cookie = await getCookie();

  if (!cookie) return false;

  const session = await decrypt(cookie);

  if (!session?.id) return false;

  return true;
}

// Check session cookie is present.
export async function hasSessionCookie() {
  return Boolean(await getCookie());
}

export async function getUserProfileOrNull() {
  const hasSession = await checkSession();
  if (!hasSession) return null;
  const result = await getUser();
  if (result.error) return null;
  return {
    name: result.data.name ?? null,
    favoriteBirdId: result.data.favoriteBirdId ?? null,
  };
}
