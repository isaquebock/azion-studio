import { AsyncLocalStorage } from "node:async_hooks";

export const tokenStore = new AsyncLocalStorage<string>();

export function requireToken(): string {
  const token = tokenStore.getStore();
  if (!token) {
    throw new Error("Personal Token Azion ausente nesta requisição");
  }
  return token;
}
