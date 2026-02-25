import { defineComponent, h } from 'vue';

export const AgentAction = defineComponent({
  name: 'AgentAction',
  props: {
    action: { type: String, required: true },
    danger: { type: String as () => 'none' | 'low' | 'high', default: undefined },
    confirm: { type: String as () => 'never' | 'optional' | 'required', default: undefined },
    scope: { type: String, default: undefined },
    idempotent: { type: Boolean, default: undefined },
    as: { type: String, default: 'form' },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const agentAttrs: Record<string, string> = {
        'data-agent-kind': 'action',
        'data-agent-action': props.action,
      };
      if (props.danger) agentAttrs['data-agent-danger'] = props.danger;
      if (props.confirm) agentAttrs['data-agent-confirm'] = props.confirm;
      if (props.scope) agentAttrs['data-agent-scope'] = props.scope;
      if (props.idempotent !== undefined) agentAttrs['data-agent-idempotent'] = String(props.idempotent);

      return h(props.as, { ...agentAttrs, ...attrs }, slots.default?.());
    };
  },
});

export const AgentField = defineComponent({
  name: 'AgentField',
  props: {
    field: { type: String, required: true },
    forAction: { type: String, default: undefined },
    as: { type: String, default: 'input' },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const agentAttrs: Record<string, string> = {
        'data-agent-kind': 'field',
        'data-agent-field': props.field,
      };
      if (props.forAction) agentAttrs['data-agent-for-action'] = props.forAction;

      return h(props.as, { ...agentAttrs, ...attrs }, slots.default?.());
    };
  },
});
