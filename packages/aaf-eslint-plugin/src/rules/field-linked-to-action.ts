import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require agent fields to be nested in an action or linked via data-agent-for-action',
    },
    messages: {
      fieldNotLinked: 'Agent field must be nested inside an agent action element or have a data-agent-for-action attribute.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node: any) {
        const attrs = node.attributes || [];

        let isField = false;
        let hasForAction = false;

        for (const attr of attrs) {
          if (attr.type !== 'JSXAttribute') continue;
          const name = attr.name?.type === 'JSXNamespacedName'
            ? `${attr.name.namespace.name}:${attr.name.name.name}`
            : attr.name?.name;

          if (name === 'data-agent-kind' && attr.value?.type === 'Literal' && attr.value.value === 'field') {
            isField = true;
          }
          if (name === 'data-agent-for-action') {
            hasForAction = true;
          }
        }

        if (!isField) return;
        if (hasForAction) return;

        // Walk up the AST to find a parent with data-agent-kind="action"
        let parent = node.parent;
        while (parent) {
          if (parent.type === 'JSXElement' && parent.openingElement) {
            const parentAttrs = parent.openingElement.attributes || [];
            for (const attr of parentAttrs) {
              if (attr.type !== 'JSXAttribute') continue;
              const name = attr.name?.type === 'JSXNamespacedName'
                ? `${attr.name.namespace.name}:${attr.name.name.name}`
                : attr.name?.name;
              if (name === 'data-agent-kind' && attr.value?.type === 'Literal' && attr.value.value === 'action') {
                return; // Found parent action — valid
              }
            }
          }
          parent = parent.parent;
        }

        context.report({
          node,
          messageId: 'fieldNotLinked',
        });
      },
    };
  },
};

export default rule;
