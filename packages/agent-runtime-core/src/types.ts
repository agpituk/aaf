export interface AgentPage {
  title: string;
  description?: string;
  actions?: string[];
  data?: string[];
}

/** Read-only data view — navigating to its page is the "execution." */
export interface AgentDataView {
  title: string;
  description?: string;
  scope: string;
  inputSchema?: Record<string, unknown>;  // optional query parameters for filtering
  outputSchema: Record<string, unknown>;
}

export interface AgentManifest {
  '@context'?: string | Record<string, unknown> | Array<string | Record<string, unknown>>;
  version: string;
  site: {
    name: string;
    origin: string;
    description?: string;
  };
  actions: Record<string, AgentAction>;
  data?: Record<string, AgentDataView>;
  errors?: Record<string, { message: string }>;
  pages?: Record<string, AgentPage>;
}

export interface AgentAction {
  title: string;
  description?: string;
  scope: string;
  risk: 'none' | 'low' | 'high';
  confirmation: 'never' | 'optional' | 'review' | 'required';
  idempotent: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export type AgentKind = 'action' | 'field' | 'status' | 'result' | 'collection' | 'item' | 'dialog' | 'step' | 'link';

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
  page?: string;
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

export interface DiscoveredLink {
  page: string;
  tagName: string;
  textContent?: string;
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

// --- AAF Adapter Interface ---

export interface ActionCatalog {
  actions: DiscoveredAction[];
  url: string;
  timestamp: string;
}

export interface AAFValidationResult {
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
 * Platform-agnostic adapter for AAF runtimes.
 * Implemented by PlaywrightAdapter (testing).
 */
export interface AAFAdapter {
  /** Check if the current page has AAF semantic elements */
  detect(): Promise<boolean>;
  /** Discover all available actions on the current page */
  discover(): Promise<ActionCatalog>;
  /** Validate an action request against manifest schema */
  validate(actionName: string, args: Record<string, unknown>, manifest: AgentManifest): AAFValidationResult;
  /** Execute an action on the page */
  execute(options: ExecuteOptions): Promise<ExecutionResult>;
}
