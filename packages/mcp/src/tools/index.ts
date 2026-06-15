import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEdgeAppTools } from "./edge-apps.js";
import { registerEdgeFunctionTools } from "./edge-functions.js";
import { registerDomainsDnsTools } from "./domains-dns.js";
import { registerRulesEngineTools } from "./rules-engine.js";
import { registerEdgeStorageTools } from "./edge-storage.js";
import { registerWafSecurityTools } from "./waf-security.js";
import { registerRealtimeLogsTools } from "./realtime-logs.js";
import { registerMarketplaceTools } from "./marketplace.js";

export function registerAllTools(server: McpServer) {
  registerEdgeAppTools(server);
  registerEdgeFunctionTools(server);
  registerDomainsDnsTools(server);
  registerRulesEngineTools(server);
  registerEdgeStorageTools(server);
  registerWafSecurityTools(server);
  registerRealtimeLogsTools(server);
  registerMarketplaceTools(server);
}
