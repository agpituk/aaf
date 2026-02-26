import type { Directive } from 'vue';

/**
 * v-agent-action="actionName"
 * Sets data-agent-kind="action" and data-agent-action on the element.
 */
export const vAgentAction: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.setAttribute('data-agent-kind', 'action');
    el.setAttribute('data-agent-action', binding.value);
  },
  updated(el, binding) {
    el.setAttribute('data-agent-action', binding.value);
  },
};

/**
 * v-agent-field="fieldName"
 * Sets data-agent-kind="field" and data-agent-field on the element.
 */
export const vAgentField: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.setAttribute('data-agent-kind', 'field');
    el.setAttribute('data-agent-field', binding.value);
  },
  updated(el, binding) {
    el.setAttribute('data-agent-field', binding.value);
  },
};

/**
 * v-agent-danger="level"
 * Sets data-agent-danger attribute. Values: 'none' | 'low' | 'high'
 */
export const vAgentDanger: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.setAttribute('data-agent-danger', binding.value);
  },
  updated(el, binding) {
    el.setAttribute('data-agent-danger', binding.value);
  },
};

/**
 * v-agent-confirm="requirement"
 * Sets data-agent-confirm attribute. Values: 'never' | 'optional' | 'review' | 'required'
 */
export const vAgentConfirm: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.setAttribute('data-agent-confirm', binding.value);
  },
  updated(el, binding) {
    el.setAttribute('data-agent-confirm', binding.value);
  },
};

/**
 * v-agent-scope="scopeName"
 * Sets data-agent-scope attribute, e.g. "invoices.write"
 */
export const vAgentScope: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.setAttribute('data-agent-scope', binding.value);
  },
  updated(el, binding) {
    el.setAttribute('data-agent-scope', binding.value);
  },
};
