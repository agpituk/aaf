/**
 * Checks that llms.txt exists and references the manifest correctly.
 */
export interface LlmsTxtCheckResult {
  exists: boolean;
  valid: boolean;
  referencesManifest: boolean;
  errors: string[];
}

export async function checkLlmsTxt(baseUrl: string): Promise<LlmsTxtCheckResult> {
  const result: LlmsTxtCheckResult = {
    exists: false,
    valid: false,
    referencesManifest: false,
    errors: [],
  };

  try {
    const url = baseUrl.replace(/\/$/, '') + '/llms.txt';
    const res = await fetch(url);
    if (!res.ok) {
      result.errors.push(`llms.txt not found at ${url} (HTTP ${res.status})`);
      return result;
    }

    result.exists = true;
    const content = await res.text();

    // Check basic structure
    if (!content.startsWith('#')) {
      result.errors.push('llms.txt should start with a # header');
    }

    // Check for manifest reference
    if (content.includes('agent-manifest.json') || content.includes('## Manifest')) {
      result.referencesManifest = true;
    } else {
      result.errors.push('llms.txt does not reference agent-manifest.json');
    }

    // Check for sections
    if (!content.includes('## Actions') && !content.includes('## Data')) {
      result.errors.push('llms.txt should contain ## Actions or ## Data sections');
    }

    result.valid = result.errors.length === 0;
  } catch (err) {
    result.errors.push(`Failed to fetch llms.txt: ${(err as Error).message}`);
  }

  return result;
}
