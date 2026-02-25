import { MSG } from '../../shared/messages.js';
import { ConfirmationDialog } from './confirmation-dialog.js';
import type { PlanAndExecuteResult } from '../../shared/messages.js';

/**
 * Chat panel: sends PLAN_AND_EXECUTE to content script (via background),
 * displays the plan + result, and handles confirmation flow.
 *
 * Key difference from Chrome: no PlannerInterface/setPlanner here.
 * Planning happens in the content script where both DOM and Harbor live.
 */
export class ChatPanel {
  private messages: HTMLElement;
  private form: HTMLFormElement;
  private input: HTMLInputElement;
  private confirmation: ConfirmationDialog;

  constructor() {
    this.messages = document.getElementById('chat-messages')!;
    this.form = document.getElementById('chat-form') as HTMLFormElement;
    this.input = document.getElementById('chat-input') as HTMLInputElement;
    this.confirmation = new ConfirmationDialog();

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  private async handleSubmit(): Promise<void> {
    const text = this.input.value.trim();
    if (!text) return;

    this.input.value = '';
    this.addMessage('user', text);

    try {
      this.addMessage('system', 'Planning and executing via Harbor...');

      // Single message: content script handles discover → plan → execute
      const response = await browser.runtime.sendMessage({
        type: MSG.PLAN_AND_EXECUTE,
        payload: { userMessage: text },
      }) as PlanAndExecuteResult;

      if (response.error) {
        this.addMessage('error', `Error: ${response.error}`);
        return;
      }

      // Show what was planned
      if (response.planned) {
        this.addMessage(
          'assistant',
          `Planned: <strong>${response.planned.action}</strong><pre>${JSON.stringify(response.planned.args, null, 2)}</pre>`
        );
      }

      // Handle execution result
      if (response.execution) {
        this.handleResult(response);
      }
    } catch (err) {
      this.addMessage('error', `Error: ${(err as Error).message}`);
    }
  }

  private async handleResult(response: PlanAndExecuteResult): Promise<void> {
    const exec = response.execution!;

    switch (exec.status) {
      case 'completed':
        this.addMessage('assistant', `Done! ${exec.result || 'Action completed successfully.'}`);
        break;

      case 'needs_confirmation': {
        const meta = exec.confirmation_metadata!;
        const confirmed = await this.confirmation.show(meta);
        if (confirmed) {
          this.addMessage('system', 'Confirmed. Re-executing...');
          const confirmResponse = await browser.runtime.sendMessage({
            type: MSG.EXECUTE_CONFIRMED,
            payload: {
              actionName: response.planned!.action,
              args: response.planned!.args,
            },
          }) as PlanAndExecuteResult;

          if (confirmResponse.error) {
            this.addMessage('error', `Error: ${confirmResponse.error}`);
          } else if (confirmResponse.execution) {
            const status = confirmResponse.execution.status;
            if (status === 'completed') {
              this.addMessage('assistant', `Done! ${confirmResponse.execution.result || 'Action completed successfully.'}`);
            } else {
              this.addMessage('error', `Execution failed: ${confirmResponse.execution.error || status}`);
            }
          }
        } else {
          this.addMessage('system', 'Action cancelled by user.');
        }
        break;
      }

      case 'validation_error':
        this.addMessage('error', `Validation error: ${exec.error}`);
        break;

      case 'missing_required_fields':
        this.addMessage('error', `Missing required fields: ${exec.missing_fields?.join(', ')}`);
        break;

      case 'execution_error':
        this.addMessage('error', `Execution error: ${exec.error}`);
        break;
    }
  }

  addMessage(type: 'user' | 'assistant' | 'system' | 'error', text: string) {
    const el = document.createElement('div');
    el.className = `msg ${type}`;
    el.innerHTML = text;
    this.messages.appendChild(el);
    this.messages.scrollTop = this.messages.scrollHeight;
  }
}
