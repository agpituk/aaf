// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { AgentAction, AgentField } from './components.js';

describe('AgentAction component', () => {
  it('renders form with agent attributes', () => {
    const wrapper = mount(AgentAction, {
      props: { action: 'invoice.create' },
      slots: { default: 'content' },
    });
    expect(wrapper.element.tagName).toBe('FORM');
    expect(wrapper.attributes('data-agent-kind')).toBe('action');
    expect(wrapper.attributes('data-agent-action')).toBe('invoice.create');
  });

  it('passes danger, confirm, scope, idempotent', () => {
    const wrapper = mount(AgentAction, {
      props: {
        action: 'workspace.delete',
        danger: 'high',
        confirm: 'required',
        scope: 'workspace.admin',
        idempotent: false,
      },
    });
    expect(wrapper.attributes('data-agent-danger')).toBe('high');
    expect(wrapper.attributes('data-agent-confirm')).toBe('required');
    expect(wrapper.attributes('data-agent-scope')).toBe('workspace.admin');
    expect(wrapper.attributes('data-agent-idempotent')).toBe('false');
  });

  it('renders as custom element', () => {
    const wrapper = mount(AgentAction, {
      props: { action: 'invoice.list', as: 'div' },
    });
    expect(wrapper.element.tagName).toBe('DIV');
  });
});

describe('AgentField component', () => {
  it('renders input with agent attributes', () => {
    const wrapper = mount(AgentField, {
      props: { field: 'customer_email' },
    });
    expect(wrapper.element.tagName).toBe('INPUT');
    expect(wrapper.attributes('data-agent-kind')).toBe('field');
    expect(wrapper.attributes('data-agent-field')).toBe('customer_email');
  });

  it('sets forAction attribute', () => {
    const wrapper = mount(AgentField, {
      props: { field: 'amount', forAction: 'invoice.create' },
    });
    expect(wrapper.attributes('data-agent-for-action')).toBe('invoice.create');
  });

  it('renders as select', () => {
    const wrapper = mount(AgentField, {
      props: { field: 'currency', as: 'select' },
    });
    expect(wrapper.element.tagName).toBe('SELECT');
  });
});
