export interface AgentActionProps {
  action: string;
  danger?: 'none' | 'low' | 'high';
  confirm?: 'never' | 'optional' | 'review' | 'required';
  scope?: string;
  idempotent?: boolean;
}

export interface AgentFieldProps {
  name: string;
  forAction?: string;
}

export interface DiscoveredActionSummary {
  action: string;
  title?: string;
  risk?: string;
  confirmation?: string;
  scope?: string;
  fields: Array<{ field: string; tagName: string }>;
}
