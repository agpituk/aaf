/**
 * Message types for Firefox extension component communication.
 * Sidebar <-> Background <-> Content Script
 *
 * Key difference from Chrome extension: PLAN_AND_EXECUTE combines
 * discovery + planning + execution into a single content script call.
 */

export const MSG = {
  // Content script -> Background
  AWI_DETECTED: 'AWI_DETECTED',

  // Sidebar -> Content script (via background)
  PLAN_AND_EXECUTE: 'PLAN_AND_EXECUTE',
  EXECUTE_CONFIRMED: 'EXECUTE_CONFIRMED',
  DISCOVER_ACTIONS: 'DISCOVER_ACTIONS',
  DETECT_AWI: 'DETECT_AWI',

  // Content script -> Sidebar (via background)
  DISCOVERY_RESULT: 'DISCOVERY_RESULT',
  DETECTION_RESULT: 'DETECTION_RESULT',
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface PlanAndExecuteMessage extends ExtensionMessage {
  type: typeof MSG.PLAN_AND_EXECUTE;
  payload: {
    userMessage: string;
  };
}

export interface ExecuteConfirmedMessage extends ExtensionMessage {
  type: typeof MSG.EXECUTE_CONFIRMED;
  payload: {
    actionName: string;
    args: Record<string, unknown>;
  };
}

export interface DiscoverActionsMessage extends ExtensionMessage {
  type: typeof MSG.DISCOVER_ACTIONS;
}

export interface DetectAWIMessage extends ExtensionMessage {
  type: typeof MSG.DETECT_AWI;
}

/** Result returned from PLAN_AND_EXECUTE */
export interface PlanAndExecuteResult {
  planned?: {
    action: string;
    args: Record<string, unknown>;
  };
  execution?: {
    status: string;
    result?: string;
    error?: string;
    confirmation_metadata?: {
      action: string;
      risk: string;
      scope: string;
      title: string;
    };
    missing_fields?: string[];
    log?: unknown;
  };
  error?: string;
}
