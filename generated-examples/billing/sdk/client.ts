// Auto-generated client for Example Billing
// Origin: http://localhost:5173

import type { InvoiceCreateInput, InvoiceCreateOutput, InvoiceListInput, InvoiceListOutput, WorkspaceDeleteInput, WorkspaceDeleteOutput } from './types.js';

export const MANIFEST_VERSION = '0.1';
export const SITE_ORIGIN = 'http://localhost:5173';

export interface ActionMetadata {
  title: string;
  scope: string;
  risk: 'none' | 'low' | 'high';
  confirmation: 'never' | 'optional' | 'required';
  idempotent: boolean;
}

export class ExampleBillingClient {
  constructor(private readonly baseUrl: string = 'http://localhost:5173') {}

  /**
   * Create invoice
   * @scope invoices.write
   * @risk low
   * @confirmation optional
   * @warning Not idempotent
   */
  async invoiceCreate(input: InvoiceCreateInput): Promise<InvoiceCreateOutput> {
    // Direct mode: POST to action endpoint
    const response = await fetch(`${this.baseUrl}/api/actions/invoice.create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json() as Promise<InvoiceCreateOutput>;
  }

  static invoiceCreateMetadata: ActionMetadata = {
    title: 'Create invoice',
    scope: 'invoices.write',
    risk: 'low',
    confirmation: 'optional',
    idempotent: false,
  };

  /**
   * List invoices
   * @scope invoices.read
   * @risk none
   * @confirmation never
   */
  async invoiceList(input: InvoiceListInput): Promise<InvoiceListOutput> {
    // Direct mode: POST to action endpoint
    const response = await fetch(`${this.baseUrl}/api/actions/invoice.list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json() as Promise<InvoiceListOutput>;
  }

  static invoiceListMetadata: ActionMetadata = {
    title: 'List invoices',
    scope: 'invoices.read',
    risk: 'none',
    confirmation: 'never',
    idempotent: true,
  };

  /**
   * Delete workspace
   * @scope workspace.delete
   * @risk high
   * @confirmation required
   * @warning Not idempotent
   */
  async workspaceDelete(input: WorkspaceDeleteInput): Promise<WorkspaceDeleteOutput> {
    // Direct mode: POST to action endpoint
    const response = await fetch(`${this.baseUrl}/api/actions/workspace.delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json() as Promise<WorkspaceDeleteOutput>;
  }

  static workspaceDeleteMetadata: ActionMetadata = {
    title: 'Delete workspace',
    scope: 'workspace.delete',
    risk: 'high',
    confirmation: 'required',
    idempotent: false,
  };

}
