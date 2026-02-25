/**
 * Manages the confirmation dialog for high-risk actions.
 */
export interface ConfirmationRequest {
  action: string;
  risk: string;
  scope: string;
  title: string;
}

export class ConfirmationDialog {
  private dialog: HTMLElement;
  private textEl: HTMLElement;
  private riskEl: HTMLElement;
  private scopeEl: HTMLElement;
  private confirmBtn: HTMLElement;
  private cancelBtn: HTMLElement;
  private resolvePromise: ((confirmed: boolean) => void) | null = null;

  constructor() {
    this.dialog = document.getElementById('confirmation-dialog')!;
    this.textEl = document.getElementById('confirmation-text')!;
    this.riskEl = document.getElementById('confirmation-risk')!;
    this.scopeEl = document.getElementById('confirmation-scope')!;
    this.confirmBtn = document.getElementById('confirm-yes')!;
    this.cancelBtn = document.getElementById('confirm-no')!;

    this.confirmBtn.addEventListener('click', () => this.resolve(true));
    this.cancelBtn.addEventListener('click', () => this.resolve(false));
  }

  async show(request: ConfirmationRequest): Promise<boolean> {
    this.textEl.textContent = `Are you sure you want to: ${request.title}?`;
    this.riskEl.textContent = `${request.risk} risk`;
    this.riskEl.className = `risk-badge ${request.risk}`;
    this.scopeEl.textContent = `Scope: ${request.scope}`;
    this.dialog.classList.remove('hidden');

    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private resolve(confirmed: boolean) {
    this.dialog.classList.add('hidden');
    if (this.resolvePromise) {
      this.resolvePromise(confirmed);
      this.resolvePromise = null;
    }
  }
}
