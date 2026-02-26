import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require data-agent-confirm="required" when data-agent-danger="high"',
    },
    messages: {
      missingConfirm: 'Elements with data-agent-danger="high" must also have data-agent-confirm="required".',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node: any) {
        const attrs = node.attributes || [];

        let dangerValue: string | null = null;
        let confirmValue: string | null = null;

        for (const attr of attrs) {
          if (attr.type !== 'JSXAttribute') continue;
          const name = attr.name?.type === 'JSXNamespacedName'
            ? `${attr.name.namespace.name}:${attr.name.name.name}`
            : attr.name?.name;

          if (name === 'data-agent-danger') {
            dangerValue = attr.value?.type === 'Literal' ? String(attr.value.value) : null;
          }
          if (name === 'data-agent-confirm') {
            confirmValue = attr.value?.type === 'Literal' ? String(attr.value.value) : null;
          }
        }

        if (dangerValue === 'high' && confirmValue !== 'required') {
          context.report({
            node,
            messageId: 'missingConfirm',
          });
        }
      },
    };
  },
};

export default rule;
