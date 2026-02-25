import dangerRequiresConfirm from './rules/danger-requires-confirm.js';
import actionHasManifest from './rules/action-has-manifest.js';
import fieldLinkedToAction from './rules/field-linked-to-action.js';

const plugin = {
  rules: {
    'danger-requires-confirm': dangerRequiresConfirm,
    'action-has-manifest': actionHasManifest,
    'field-linked-to-action': fieldLinkedToAction,
  },
};

export default plugin;
