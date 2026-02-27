import type { DiscoveredAction, DiscoveredField, ExecutionLog } from '@agent-accessibility-framework/runtime-core';

/**
 * Status codes returned by the runtime after executing an action.
 */
export type RuntimeStatus =
  | 'completed'
  | 'awaiting_review'
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
 * Result returned by a planner: an executable action, a navigation directive, or a direct answer.
 * This is the contract between the planner layer and the runtime/widget layer.
 */
export type PlannerResult =
  | { kind: 'action'; request: PlannerRequest }
  | { kind: 'navigate'; page: string }
  | { kind: 'answer'; text: string };

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
 * Summary of a field with optional semantic type annotation.
 */
export interface FieldSummary {
  name: string;
  semantic?: string;  // x-semantic URI (e.g. "https://schema.org/email")
}

/**
 * Summary of a queryable data view from the manifest.
 */
export interface DataViewSummary {
  dataView: string;
  title: string;
  description?: string;
  page: string;       // route like "/invoices/"
  pageTitle: string;   // "Invoice List"
  fields: FieldSummary[];  // query parameter names + semantic types
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
