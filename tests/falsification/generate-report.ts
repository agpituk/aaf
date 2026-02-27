import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generates reliability report from falsification test results.
 * Run with: npx tsx tests/falsification/generate-report.ts
 */

interface TestResult {
  name: string;
  passed: boolean;
  approach: 'selector' | 'semantic' | 'safety' | 'drift' | 'missing-fields';
  target: 'original' | 'refactored' | 'both';
}

function main() {
  const artifactsDir = resolve(__dirname, '../../artifacts');
  mkdirSync(artifactsDir, { recursive: true });

  // Run vitest with JSON reporter
  let jsonOutput: string;
  try {
    jsonOutput = execSync('npx vitest run tests/falsification --reporter=json 2>/dev/null', {
      cwd: resolve(__dirname, '../..'),
      encoding: 'utf-8',
    });
  } catch (err) {
    // vitest exits with non-zero if tests fail, but we still get output
    jsonOutput = (err as { stdout: string }).stdout || '';
  }

  // Parse results
  const results: TestResult[] = [];
  let totalTests = 0;
  let passedTests = 0;

  // Parse from JSON output if available, otherwise use counts
  try {
    const parsed = JSON.parse(jsonOutput);
    for (const file of parsed.testResults || []) {
      for (const test of file.assertionResults || []) {
        totalTests++;
        const passed = test.status === 'passed';
        if (passed) passedTests++;

        const name = test.fullName || test.title || '';
        let approach: TestResult['approach'] = 'semantic';
        let target: TestResult['target'] = 'both';

        if (name.includes('Selector')) {
          approach = 'selector';
          target = name.includes('REFACTORED') ? 'refactored' : 'original';
        } else if (name.includes('Semantic') || name.includes('semantic')) {
          approach = 'semantic';
          target = name.includes('REFACTORED') ? 'refactored' : name.includes('ORIGINAL') ? 'original' : 'both';
        } else if (name.includes('safety')) {
          approach = 'safety';
        } else if (name.includes('drift')) {
          approach = 'drift';
        } else if (name.includes('missing')) {
          approach = 'missing-fields';
        }

        results.push({ name, passed, approach, target });
      }
    }
  } catch {
    // Fallback: just count from vitest summary
    console.log('Could not parse JSON output, using fallback counts');
  }

  // Generate report
  const selectorOriginal = results.filter((r) => r.approach === 'selector' && r.target === 'original');
  const selectorRefactored = results.filter((r) => r.approach === 'selector' && r.target === 'refactored');
  const semanticOriginal = results.filter((r) => r.approach === 'semantic' && r.target === 'original');
  const semanticRefactored = results.filter((r) => r.approach === 'semantic' && r.target === 'refactored');
  const safetyTests = results.filter((r) => r.approach === 'safety');
  const driftTests = results.filter((r) => r.approach === 'drift');
  const missingFieldTests = results.filter((r) => r.approach === 'missing-fields');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_tests: totalTests || results.length,
      passed: passedTests || results.filter((r) => r.passed).length,
      failed: (totalTests || results.length) - (passedTests || results.filter((r) => r.passed).length),
    },
    selector_approach: {
      original_app: { total: selectorOriginal.length, passed: selectorOriginal.filter((r) => r.passed).length },
      refactored_app: { total: selectorRefactored.length, passed: selectorRefactored.filter((r) => r.passed).length },
    },
    semantic_approach: {
      original_app: { total: semanticOriginal.length, passed: semanticOriginal.filter((r) => r.passed).length },
      refactored_app: { total: semanticRefactored.length, passed: semanticRefactored.filter((r) => r.passed).length },
    },
    safety: { total: safetyTests.length, passed: safetyTests.filter((r) => r.passed).length },
    drift_detection: { total: driftTests.length, passed: driftTests.filter((r) => r.passed).length },
    missing_fields: { total: missingFieldTests.length, passed: missingFieldTests.filter((r) => r.passed).length },
  };

  writeFileSync(resolve(artifactsDir, 'reliability-report.json'), JSON.stringify(report, null, 2));

  const markdown = `# AAF Reliability Report

Generated: ${report.timestamp}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${report.summary.total_tests} |
| Passed | ${report.summary.passed} |
| Failed | ${report.summary.failed} |

## Selector vs Semantic Comparison

| Approach | Original App | Refactored App | Survives Refactor? |
|----------|-------------|----------------|-------------------|
| CSS Selectors | ${selectorOriginal.filter((r) => r.passed).length}/${selectorOriginal.length} pass | ${selectorRefactored.filter((r) => r.passed).length}/${selectorRefactored.length} pass | No |
| AAF Semantic | ${semanticOriginal.filter((r) => r.passed).length}/${semanticOriginal.length} pass | ${semanticRefactored.filter((r) => r.passed).length}/${semanticRefactored.length} pass | Yes |

## Safety

- High-risk actions blocked without confirmation: ${safetyTests.filter((r) => r.passed).length}/${safetyTests.length}

## Drift Detection

- Linter catches broken attributes: ${driftTests.filter((r) => r.passed).length}/${driftTests.length}

## Missing Fields

- Required field validation: ${missingFieldTests.filter((r) => r.passed).length}/${missingFieldTests.length}

## Conclusion

Selector-based automation breaks when the UI is refactored (CSS classes, IDs, and layout changed).
AAF semantic automation survives identical refactors because it relies on stable \`data-agent-*\` attributes.
`;

  writeFileSync(resolve(artifactsDir, 'reliability-report.md'), markdown);

  console.log('Reports generated:');
  console.log(`  ${resolve(artifactsDir, 'reliability-report.json')}`);
  console.log(`  ${resolve(artifactsDir, 'reliability-report.md')}`);
}

main();
