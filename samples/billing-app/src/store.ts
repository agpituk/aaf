export interface Invoice {
  id: string;
  customer_email: string;
  amount: number;
  currency: string;
  memo: string;
  status: 'draft' | 'sent';
  created_at: string;
}

const STORAGE_KEY = 'billing-app-invoices';

function load(): Invoice[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function save(invoices: Invoice[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

export function getInvoices(): Invoice[] {
  return load();
}

export function createInvoice(data: {
  customer_email: string;
  amount: number;
  currency: string;
  memo: string;
}): Invoice {
  const invoices = load();
  const invoice: Invoice = {
    id: `INV-${Date.now().toString(36).toUpperCase()}`,
    ...data,
    status: 'draft',
    created_at: new Date().toISOString(),
  };
  invoices.push(invoice);
  save(invoices);
  return invoice;
}

export function deleteAllInvoices(): void {
  save([]);
}
