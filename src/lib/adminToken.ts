"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "vcpi_admin_token";

/** Admin token remembered in this browser (shared by Run now and note edits). */
export function useAdminToken(): [string, (t: string) => void] {
  const [token, setTokenState] = useState("");
  useEffect(() => {
    try {
      setTokenState(localStorage.getItem(KEY) ?? "");
    } catch {
      /* storage blocked */
    }
  }, []);
  const setToken = useCallback((t: string) => {
    setTokenState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked */
    }
  }, []);
  return [token, setToken];
}
