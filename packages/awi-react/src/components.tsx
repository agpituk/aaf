import React from 'react';

// --- Types ---

export interface AgentActionProps extends React.FormHTMLAttributes<HTMLFormElement> {
  /** Dot-notation action identifier, e.g. "invoice.create" */
  action: string;
  /** Risk level */
  danger?: 'none' | 'low' | 'high';
  /** Confirmation requirement */
  confirm?: 'never' | 'optional' | 'required';
  /** Permission scope, e.g. "invoices.write" */
  scope?: string;
  /** Whether the action is idempotent */
  idempotent?: boolean;
  /** Render as a different element instead of form */
  as?: keyof React.JSX.IntrinsicElements;
  children?: React.ReactNode;
}

export interface AgentFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** snake_case field identifier */
  field: string;
  /** Link to an action when not nested inside AgentAction */
  forAction?: string;
  /** Render as select or textarea instead of input */
  as?: 'input' | 'select' | 'textarea';
  children?: React.ReactNode;
}

export interface AgentSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Parent action name — button gets data-agent-action="parent.submit" */
  action: string;
  children?: React.ReactNode;
}

export interface AgentStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Output identifier, e.g. "invoice.create.status" */
  output: string;
  children?: React.ReactNode;
}

// --- Components ---

export function AgentAction({
  action,
  danger,
  confirm,
  scope,
  idempotent,
  as: Element = 'form',
  children,
  ...rest
}: AgentActionProps) {
  const agentAttrs: Record<string, string> = {
    'data-agent-kind': 'action',
    'data-agent-action': action,
  };
  if (danger) agentAttrs['data-agent-danger'] = danger;
  if (confirm) agentAttrs['data-agent-confirm'] = confirm;
  if (scope) agentAttrs['data-agent-scope'] = scope;
  if (idempotent !== undefined) agentAttrs['data-agent-idempotent'] = String(idempotent);

  return React.createElement(Element, { ...agentAttrs, ...rest }, children);
}

export function AgentField({
  field,
  forAction,
  as = 'input',
  children,
  ...rest
}: AgentFieldProps) {
  const agentAttrs: Record<string, string> = {
    'data-agent-kind': 'field',
    'data-agent-field': field,
  };
  if (forAction) agentAttrs['data-agent-for-action'] = forAction;

  return React.createElement(as, { ...agentAttrs, ...rest }, children);
}

export function AgentSubmit({
  action,
  children,
  ...rest
}: AgentSubmitProps) {
  return React.createElement(
    'button',
    {
      type: 'submit' as const,
      'data-agent-kind': 'action',
      'data-agent-action': `${action}.submit`,
      ...rest,
    },
    children,
  );
}

export function AgentStatus({
  output,
  children,
  ...rest
}: AgentStatusProps) {
  return React.createElement(
    'div',
    {
      role: 'status',
      'aria-live': 'polite' as const,
      'data-agent-kind': 'status',
      'data-agent-output': output,
      ...rest,
    },
    children,
  );
}
