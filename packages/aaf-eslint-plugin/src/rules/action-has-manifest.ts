import type { Rule } from 'eslint';
import { readFileSync } from 'fs';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require data-agent-action values to exist in the agent manifest',
    },
    messages: {
      unknownAction: 'Action "{{action}}" is not defined in the agent manifest.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          manifestPath: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {};
    const manifestPath = options.manifestPath;

    let manifestActions: Set<string> | null = null;
    if (manifestPath) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        manifestActions = new Set(Object.keys(manifest.actions || {}));
      } catch {
        // If manifest can't be read, skip checks
        return {};
      }
    } else {
      return {};
    }

    return {
      JSXOpeningElement(node: any) {
        if (!manifestActions) return;

        const attrs = node.attributes || [];
        for (const attr of attrs) {
          if (attr.type !== 'JSXAttribute') continue;
          const name = attr.name?.type === 'JSXNamespacedName'
            ? `${attr.name.namespace.name}:${attr.name.name.name}`
            : attr.name?.name;

          if (name === 'data-agent-action' && attr.value?.type === 'Literal') {
            const action = String(attr.value.value);
            // Allow sub-actions (e.g. "invoice.create.submit" is valid if "invoice.create" exists)
            const baseAction = action.split('.').slice(0, 2).join('.');
            if (!manifestActions.has(baseAction)) {
              context.report({
                node,
                messageId: 'unknownAction',
                data: { action },
              });
            }
          }
        }
      },
    };
  },
};

export default rule;
