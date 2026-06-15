import { requireToken } from "./token-context.js";

const AZION_API = process.env.AZION_API_BASE ?? "https://api.azion.com";

export type AzionFetchInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  accept?: string;
};

export async function azionFetch(path: string, init: AzionFetchInit = {}): Promise<unknown> {
  const token = requireToken();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, AZION_API);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = {
    Authorization: `Token ${token}`,
    Accept: init.accept ?? "application/json; version=3",
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  const method = init.method ?? "GET";
  const start = performance.now();
  const pathWithQuery = `${url.pathname}${url.search}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    console.log(
      `[azion] ${method} ${pathWithQuery} ${ms}ms network_error="${(err as Error).message}"`,
    );
    throw err;
  }

  const text = await res.text();
  const ms = (performance.now() - start).toFixed(1);
  console.log(
    `[azion] ${method} ${pathWithQuery} ${res.status} ${ms}ms bytes=${text.length}`,
  );

  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON — leave as text
    }
  }
  if (!res.ok) {
    const err = new Error(`Azion API ${res.status} ${res.statusText}`);
    (err as Error & { status: number; body: unknown }).status = res.status;
    (err as Error & { status: number; body: unknown }).body = parsed;
    throw err;
  }
  return parsed;
}

export function toolOk(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function toolError(err: unknown) {
  const e = err as Error & { status?: number; body?: unknown };
  const detail = e.body ? `\n\n${JSON.stringify(e.body, null, 2)}` : "";
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `Erro: ${e.message ?? "desconhecido"}${detail}`,
      },
    ],
  };
}

export async function runTool<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return toolOk(data);
  } catch (err) {
    return toolError(err);
  }
}
