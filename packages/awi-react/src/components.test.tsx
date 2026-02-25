// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AgentAction, AgentField, AgentSubmit, AgentStatus } from './components.js';

describe('AgentAction', () => {
  it('renders a form with data-agent-kind="action"', () => {
    const { container } = render(
      <AgentAction action="invoice.create">content</AgentAction>
    );
    const form = container.querySelector('form')!;
    expect(form.getAttribute('data-agent-kind')).toBe('action');
    expect(form.getAttribute('data-agent-action')).toBe('invoice.create');
  });

  it('passes danger, confirm, scope, idempotent attrs', () => {
    const { container } = render(
      <AgentAction
        action="workspace.delete"
        danger="high"
        confirm="required"
        scope="workspace.admin"
        idempotent={false}
      >
        content
      </AgentAction>
    );
    const form = container.querySelector('form')!;
    expect(form.getAttribute('data-agent-danger')).toBe('high');
    expect(form.getAttribute('data-agent-confirm')).toBe('required');
    expect(form.getAttribute('data-agent-scope')).toBe('workspace.admin');
    expect(form.getAttribute('data-agent-idempotent')).toBe('false');
  });

  it('renders as a custom element via "as" prop', () => {
    const { container } = render(
      <AgentAction action="invoice.list" as="div">content</AgentAction>
    );
    const div = container.querySelector('div[data-agent-kind="action"]')!;
    expect(div).toBeTruthy();
    expect(div.tagName).toBe('DIV');
  });

  it('forwards extra HTML attributes', () => {
    const { container } = render(
      <AgentAction action="test.action" className="my-form" id="test-form">
        content
      </AgentAction>
    );
    const form = container.querySelector('form')!;
    expect(form.className).toBe('my-form');
    expect(form.id).toBe('test-form');
  });
});

describe('AgentField', () => {
  it('renders an input with data-agent-kind="field"', () => {
    const { container } = render(
      <AgentField field="customer_email" type="email" />
    );
    const input = container.querySelector('input')!;
    expect(input.getAttribute('data-agent-kind')).toBe('field');
    expect(input.getAttribute('data-agent-field')).toBe('customer_email');
    expect(input.type).toBe('email');
  });

  it('sets data-agent-for-action when forAction is provided', () => {
    const { container } = render(
      <AgentField field="amount" forAction="invoice.create" />
    );
    const input = container.querySelector('input')!;
    expect(input.getAttribute('data-agent-for-action')).toBe('invoice.create');
  });

  it('renders as select element', () => {
    const { container } = render(
      <AgentField field="currency" as="select">
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
      </AgentField>
    );
    const select = container.querySelector('select')!;
    expect(select.getAttribute('data-agent-kind')).toBe('field');
    expect(select.getAttribute('data-agent-field')).toBe('currency');
    expect(select.children.length).toBe(2);
  });

  it('renders as textarea element', () => {
    const { container } = render(
      <AgentField field="memo" as="textarea" />
    );
    const textarea = container.querySelector('textarea')!;
    expect(textarea.getAttribute('data-agent-kind')).toBe('field');
    expect(textarea.getAttribute('data-agent-field')).toBe('memo');
  });
});

describe('AgentSubmit', () => {
  it('renders a submit button with sub-action', () => {
    const { container } = render(
      <AgentSubmit action="invoice.create">Submit</AgentSubmit>
    );
    const button = container.querySelector('button')!;
    expect(button.type).toBe('submit');
    expect(button.getAttribute('data-agent-kind')).toBe('action');
    expect(button.getAttribute('data-agent-action')).toBe('invoice.create.submit');
    expect(button.textContent).toBe('Submit');
  });

  it('forwards extra props', () => {
    const { container } = render(
      <AgentSubmit action="test" className="btn" disabled>Go</AgentSubmit>
    );
    const button = container.querySelector('button')!;
    expect(button.className).toBe('btn');
    expect(button.disabled).toBe(true);
  });
});

describe('AgentStatus', () => {
  it('renders a status element with output attr', () => {
    const { container } = render(
      <AgentStatus output="invoice.create.status">Success</AgentStatus>
    );
    const div = container.querySelector('div')!;
    expect(div.getAttribute('data-agent-kind')).toBe('status');
    expect(div.getAttribute('data-agent-output')).toBe('invoice.create.status');
    expect(div.getAttribute('role')).toBe('status');
    expect(div.getAttribute('aria-live')).toBe('polite');
    expect(div.textContent).toBe('Success');
  });
});
