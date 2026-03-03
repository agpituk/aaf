/**
 * Declares a cross-site action handoff — mapping output fields from a source
 * action to input fields of a target action on another site.
 */
export interface ActionHandoff {
  /** URL of the target site's agent-manifest.json */
  target: string;
  /** Action ID on the target site */
  targetAction: string;
  /** Maps source output field names to target input field names */
  fieldMap: Record<string, string>;
}

/**
 * Validates a handoff configuration.
 * Checks that target is a valid HTTPS URL and fieldMap is non-empty.
 */
export function validateHandoff(handoff: ActionHandoff): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!handoff.target) {
    errors.push('handoff.target is required');
  } else {
    try {
      const url = new URL(handoff.target);
      if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
        errors.push('handoff.target must use HTTPS (except localhost for development)');
      }
    } catch {
      errors.push('handoff.target must be a valid URL');
    }
  }

  if (!handoff.targetAction) {
    errors.push('handoff.targetAction is required');
  } else if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(handoff.targetAction)) {
    errors.push('handoff.targetAction must be a valid dot-notation action identifier');
  }

  if (!handoff.fieldMap || Object.keys(handoff.fieldMap).length === 0) {
    errors.push('handoff.fieldMap must contain at least one field mapping');
  }

  return { valid: errors.length === 0, errors };
}
