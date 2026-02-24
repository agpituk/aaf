// Auto-generated types from agent manifest

export interface InvoiceCreateInput {
  /** @format email */
  customer_email: string;
  amount: number;
  currency: 'EUR' | 'USD';
  memo?: string;
}

export interface InvoiceCreateOutput {
  invoice_id: string;
  status: 'draft' | 'sent';
}

export interface InvoiceListInput {
}

export interface InvoiceListOutput {
  invoices: unknown;
}

export interface WorkspaceDeleteInput {
  /** @const Must be "DELETE" */
  delete_confirmation_text: string;
}

export interface WorkspaceDeleteOutput {
  deleted: boolean;
}

