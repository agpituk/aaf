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
  confirmation: 'never' | 'optional' | 'required';
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
}

export interface DiscoveredStatus {
  output: string;
  tagName: string;
}

export type LogStepType = 'navigate' | 'fill' | 'click' | 'read_status' | 'validate' | 'policy_check';

export interface LogStep {
  type: LogStepType;
  url?: string;
  field?: string;
  value?: unknown;
  action?: string;
  output?: string;
  result?: string;
  error?: string;
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
