import type { App } from 'vue';
import { vAgentAction, vAgentField, vAgentDanger, vAgentConfirm, vAgentScope } from './directives.js';
import { AgentAction, AgentField } from './components.js';

export const AAFPlugin = {
  install(app: App) {
    // Register directives
    app.directive('agent-action', vAgentAction);
    app.directive('agent-field', vAgentField);
    app.directive('agent-danger', vAgentDanger);
    app.directive('agent-confirm', vAgentConfirm);
    app.directive('agent-scope', vAgentScope);

    // Register components
    app.component('AgentAction', AgentAction);
    app.component('AgentField', AgentField);
  },
};
