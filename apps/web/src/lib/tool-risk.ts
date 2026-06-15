export type Risk = "read" | "write" | "destructive";

const READ = new Set([
  "azion_list_applications",
  "azion_get_application",
  "azion_list_functions",
  "azion_get_function",
  "azion_list_domains",
  "azion_get_domain",
  "azion_list_rules",
  "azion_get_rule",
  "azion_list_buckets",
  "azion_list_objects",
  "azion_list_waf_rules",
  "azion_get_waf_rule",
  "azion_list_waf_events",
  "azion_list_data_streams",
  "azion_get_data_stream",
  "azion_list_integrations",
  "azion_get_integration",
  "azion_list_zones",
]);

const DESTRUCTIVE = new Set([
  "azion_delete_function",
  "azion_delete_domain",
  "azion_delete_rule",
  "azion_delete_object",
]);

export function getRiskLevel(toolName: string): Risk {
  if (READ.has(toolName)) return "read";
  if (DESTRUCTIVE.has(toolName)) return "destructive";
  return "write";
}
