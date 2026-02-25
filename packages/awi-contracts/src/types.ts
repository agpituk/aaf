import type { DiscoveredAction, DiscoveredField, ExecutionLog } from '@agent-native-web/runtime-core';

/**
 * Status codes returned by the runtime after executing an action.
 */
export type RuntimeStatus =
  | 'completed'
  | 'needs_confirmation'
  | 'validation_error'
  | 'execution_error'
  | 'missing_required_fields';

/**
 * Request from the planner to the runtime.
 * Planner sends semantic action names + args, NEVER selectors.
 */
export interface PlannerRequest {
  action: string;
  args: Record<string, unknown>;
  confirmed?: boolean;
}

/**
 * Summary of a discovered action exposed to the planner.
 */
export interface DiscoveredActionSummary {
  action: string;
  title?: string;
  risk?: string;
  confirmation?: string;
  scope?: string;
  idempotent?: string;
  fields: Array<{ field: string; tagName: string }>;
}

/**
 * Report of all actions discovered on the current page.
 */
export interface DiscoveryReport {
  url: string;
  actions: DiscoveredActionSummary[];
  timestamp: string;
}

/**
 * Response from the runtime after executing an action.
 */
export interface RuntimeResponse {
  status: RuntimeStatus;
  action: string;
  result?: string;
  log?: ExecutionLog;
  confirmation_metadata?: {
    action: string;
    risk: string;
    scope: string;
    title: string;
  };
  error?: string;
  missing_fields?: string[];
}
