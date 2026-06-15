# Azion Studio

Estúdio open source que opera a plataforma Azion via linguagem natural, usando MCP (Model Context Protocol) e function calling.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui + `@tanstack/ai-react`
- **LLM Host**: Node.js + Express + `@tanstack/ai`
- **MCP Server**: `@modelcontextprotocol/sdk` + Azion SDK
- **Monorepo**: pnpm workspaces

## Rodar local

```bash
pnpm install
cp .env.example .env
# preencher ANTHROPIC_API_KEY no .env

pnpm dev
# web    → http://localhost:5173
# server → http://localhost:3001
# mcp    → http://localhost:3002/sse
```

Cole seu Personal Token Azion na UI (criptografado localmente via AES-GCM, nunca enviado ao backend para persistência).

## Estrutura

```
apps/web      # React + Vite — chat UI
apps/server   # Express — LLM Host (cliente MCP)
packages/mcp  # MCP Server standalone com tools Azion
```
