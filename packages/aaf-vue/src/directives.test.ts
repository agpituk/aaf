// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, withDirectives } from 'vue';
import { vAgentAction, vAgentField, vAgentDanger, vAgentConfirm, vAgentScope } from './directives.js';

function mountWithDirective(directive: any, value: string, tag = 'div') {
  const Comp = defineComponent({
    setup() {
      return () => withDirectives(h(tag), [[directive, value]]);
    },
  });
  return mount(Comp);
}

describe('v-agent-action', () => {
  it('sets data-agent-kind and data-agent-action', () => {
    const wrapper = mountWithDirective(vAgentAction, 'invoice.create', 'form');
    expect(wrapper.find('form').attributes('data-agent-kind')).toBe('action');
    expect(wrapper.find('form').attributes('data-agent-action')).toBe('invoice.create');
  });
});

describe('v-agent-field', () => {
  it('sets data-agent-kind and data-agent-field', () => {
    const wrapper = mountWithDirective(vAgentField, 'customer_email', 'input');
    expect(wrapper.find('input').attributes('data-agent-kind')).toBe('field');
    expect(wrapper.find('input').attributes('data-agent-field')).toBe('customer_email');
  });
});

describe('v-agent-danger', () => {
  it('sets data-agent-danger', () => {
    const wrapper = mountWithDirective(vAgentDanger, 'high');
    expect(wrapper.find('div').attributes('data-agent-danger')).toBe('high');
  });
});

describe('v-agent-confirm', () => {
  it('sets data-agent-confirm', () => {
    const wrapper = mountWithDirective(vAgentConfirm, 'required');
    expect(wrapper.find('div').attributes('data-agent-confirm')).toBe('required');
  });
});

describe('v-agent-scope', () => {
  it('sets data-agent-scope', () => {
    const wrapper = mountWithDirective(vAgentScope, 'invoices.write');
    expect(wrapper.find('div').attributes('data-agent-scope')).toBe('invoices.write');
  });
});
