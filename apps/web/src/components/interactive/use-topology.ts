import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/token-store";
import type { Topology } from "./types";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string) ?? "http://localhost:3001";

type Status = "idle" | "loading" | "ready" | "error";

export function useTopology() {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setStatus("error");
        setError("Configure seu Personal Token Azion no menu do avatar.");
        return;
      }
      const res = await fetch(`${SERVER_URL}/api/ops/topology`, {
        headers: { "X-Azion-Token": token },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as Topology;
      setTopology(data);
      setStatus("ready");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { topology, status, error, reload };
}
