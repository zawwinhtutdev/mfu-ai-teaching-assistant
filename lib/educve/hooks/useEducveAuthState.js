"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultRouteForRole } from "@/lib/demo-auth";

const fallbackState = {
  isAuthenticated: false,
  portalHref: "/chat",
  role: null,
};

const normalizeInitialState = (initialState) => {
  if (!initialState) {
    return fallbackState;
  }

  return {
    isAuthenticated: Boolean(initialState.isAuthenticated),
    portalHref:
      initialState.portalHref ?? getDefaultRouteForRole(initialState.role),
    role: initialState.role ?? null,
  };
};

export const useEducveAuthState = (initialState) => {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(() => normalizeInitialState(initialState));

  const resolveAuthState = useCallback(async () => {
    let isAuthenticated = false;
    let role = null;

    try {
      const demoResponse = await fetch("/api/demo-auth/session", {
        cache: "no-store",
      });

      if (demoResponse.ok) {
        const demoPayload = await demoResponse.json();

        if (demoPayload?.isDemo && demoPayload?.account?.role) {
          isAuthenticated = true;
          role = demoPayload.account.role;
        }
      }
    } catch (error) {
      console.error("Failed to resolve demo auth state", error);
    }

    if (!isAuthenticated) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          isAuthenticated = true;
          role =
            session.user.user_metadata?.role ??
            session.user.app_metadata?.role ??
            null;
        }
      } catch (error) {
        console.error("Failed to resolve Supabase auth state", error);
      }
    }

    setState({
      isAuthenticated,
      portalHref: getDefaultRouteForRole(role),
      role,
    });
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const sync = async () => {
      if (!active) return;
      await resolveAuthState();
    };

    sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      sync();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveAuthState, supabase]);

  const signOut = useCallback(async () => {
    await fetch("/api/demo-auth/logout", { method: "POST" });
    await supabase.auth.signOut();

    setState(fallbackState);
  }, [supabase]);

  return {
    ...state,
    signOut,
  };
};
