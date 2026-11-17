"use client";

import { checkSession } from "@/helpers/auth.helpers";
import { ErrorMessages } from "@/types/error-messages.enum";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

type Auth = {
  isSignedIn: boolean;
  signIn: () => void;
  signOut: () => void;
};

export const AuthContext = createContext<Auth>({
  isSignedIn: false,
  signIn: () => {},
  signOut: () => {},
});

/** Essential app-level authentication state values */
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);

  const path = usePathname();

  const checkAuth = async () => {
    setIsSignedIn(await checkSession());
  };

  // Check auth on navigation and refresh
  useEffect(() => {
    checkAuth();
  }, [path, isSignedIn]);

  function signIn() {
    setIsSignedIn(true);
  }

  function signOut() {
    setIsSignedIn(false);
  }

  const auth: Auth = {
    isSignedIn,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error(ErrorMessages.InvalidContext);
  return context;
}
