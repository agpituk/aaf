export interface AgentManifest {
  version: string;
  site: {
    name: string;
    origin: string;
  };
  actions: Record<string, AgentAction>;
  errors?: Record<string, { message: string }>;
}

export interface AgentAction {
  title: string;
  scope: string;
  risk: 'none' | 'low' | 'high';
  confirmation: 'never' | 'optional' | 'review' | 'required';
  idempotent: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  ui?: {
    page?: string;
    rootActionSelector?: string;
  };
}

export type AgentKind = 'action' | 'field' | 'status' | 'result' | 'collection' | 'item' | 'dialog' | 'step';

export interface SemanticElement {
  kind: AgentKind;
  action?: string;
  field?: string;
  output?: string;
  danger?: string;
  confirm?: string;
  scope?: string;
  idempotent?: string;
  forAction?: string;
  version?: string;
  tagName: string;
  textContent?: string;
  children: SemanticElement[];
}

export interface DiscoveredAction {
  action: string;
  kind: AgentKind;
  danger?: string;
  confirm?: string;
  scope?: string;
  idempotent?: string;
  fields: DiscoveredField[];
  statuses: DiscoveredStatus[];
  submitAction?: string;
}

export interface DiscoveredField {
  field: string;
  tagName: string;
  forAction?: string;
  /** Available options for select/radio fields, scraped from the DOM. */
  options?: string[];
}

export interface DiscoveredStatus {
  output: string;
  tagName: string;
}

export type LogStepType = 'navigate' | 'fill' | 'click' | 'read_status' | 'validate' | 'policy_check' | 'coerce';

export interface LogStep {
  type: LogStepType;
  url?: string;
  field?: string;
  value?: unknown;
  action?: string;
  output?: string;
  result?: string;
  error?: string;
  coercions?: Array<{ field: string; from: unknown; to: unknown; rule: string }>;
}

export interface ExecutionLog {
  session_id: string;
  action: string;
  mode: 'ui' | 'direct';
  steps: LogStep[];
  timestamp: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

// --- AWI Adapter Interface ---

export interface ActionCatalog {
  actions: DiscoveredAction[];
  url: string;
  timestamp: string;
}

export interface AWIValidationResult {
  valid: boolean;
  errors: string[];
  missing_fields?: string[];
}

export interface ExecuteOptions {
  actionName: string;
  args: Record<string, unknown>;
  confirmed?: boolean;
  manifest?: AgentManifest;
}

export interface ExecutionResult {
  status: 'completed' | 'awaiting_review' | 'needs_confirmation' | 'validation_error' | 'execution_error' | 'missing_required_fields';
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

/**
 * Platform-agnostic adapter for AWI runtimes.
 * Implemented by PlaywrightAdapter (testing).
 */
export interface AWIAdapter {
  /** Check if the current page has AWI semantic elements */
  detect(): Promise<boolean>;
  /** Discover all available actions on the current page */
  discover(): Promise<ActionCatalog>;
  /** Validate an action request against manifest schema */
  validate(actionName: string, args: Record<string, unknown>, manifest: AgentManifest): AWIValidationResult;
  /** Execute an action on the page */
  execute(options: ExecuteOptions): Promise<ExecutionResult>;
}
