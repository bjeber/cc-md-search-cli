import { describe, test, expect } from 'bun:test';
import { formatOutput } from '../src/cli.js';

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

describe('formatOutput', () => {
  const sampleResults = [
    {
      file: 'test.md',
      matches: [
        {
          lineNumber: 10,
          line: 'Test line content',
          headingPath: '# Main > ## Section',
          context: 'Full context here',
          range: { start: 8, end: 12 }
        }
      ],
      frontmatter: { title: 'Test' }
    }
  ];

  const sampleFuzzyResults = [
    {
      file: 'test.md',
      score: 0.2,
      title: 'Test Document',
      frontmatter: { title: 'Test' },
      preview: 'Preview content here'
    }
  ];

  test('json mode returns valid compact JSON', () => {
    const output = formatOutput(sampleResults, 'json');
    const parsed = JSON.parse(output);

    // Compact JSON transforms the structure for AI consumption
    expect(parsed).toHaveLength(1);
    expect(parsed[0].file).toBe('test.md');
    expect(parsed[0].frontmatter).toEqual({ title: 'Test' });
    expect(parsed[0].matches).toHaveLength(1);
    expect(parsed[0].matches[0].line).toBe(10);
    expect(parsed[0].matches[0].heading).toBe('# Main > ## Section');
    expect(parsed[0].matches[0].text).toBe('Test line content');
    expect(parsed[0].matches[0].context).toBe('Full context here');
    // No whitespace in compact JSON
    expect(output).not.toContain('\n');
  });

  test('files mode returns only file paths', () => {
    const results = [
      { file: 'a.md' },
      { file: 'b.md' },
      { file: 'c.md' }
    ];

    const output = formatOutput(results, 'files');
    expect(output).toBe('a.md\nb.md\nc.md');
  });

  test('compact mode shows summary', () => {
    const output = formatOutput(sampleResults, 'compact');

    expect(output).toContain('test.md');
    expect(output).toContain('1 match(es)');
    expect(output).toContain('Line 10');
  });

  test('compact mode shows relevance score for fuzzy results', () => {
    const output = formatOutput(sampleFuzzyResults, 'compact');

    expect(output).toContain('relevance:');
    expect(output).toContain('0.80');  // 1 - 0.2
  });

  test('compact mode shows heading path', () => {
    const output = formatOutput(sampleResults, 'compact');

    expect(output).toContain('# Main > ## Section');
  });

  test('compact mode limits displayed matches', () => {
    const manyMatches = [{
      file: 'test.md',
      matches: [
        { lineNumber: 1, line: 'Line 1', headingPath: '' },
        { lineNumber: 2, line: 'Line 2', headingPath: '' },
        { lineNumber: 3, line: 'Line 3', headingPath: '' },
        { lineNumber: 4, line: 'Line 4', headingPath: '' },
        { lineNumber: 5, line: 'Line 5', headingPath: '' }
      ],
      frontmatter: {}
    }];

    const output = formatOutput(manyMatches, 'compact');

    // Should show 5 match(es) but only display first 3
    expect(output).toContain('5 match(es)');
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 3');
    expect(output).not.toContain('Line 4:');
  });

  test('compact mode truncates long lines', () => {
    const longLineResult = [{
      file: 'test.md',
      matches: [{
        lineNumber: 1,
        line: 'A'.repeat(150),
        headingPath: ''
      }],
      frontmatter: {}
    }];

    const output = formatOutput(longLineResult, 'compact');
    expect(output).toContain('...');
  });

  test('detailed mode shows full context', () => {
    const output = formatOutput(sampleResults, 'detailed');

    expect(output).toContain('Full context here');
    expect(output).toContain('lines 8-12');
  });

  test('detailed mode shows frontmatter', () => {
    const output = formatOutput(sampleResults, 'detailed');

    expect(output).toContain('title: Test');
  });

  test('detailed mode shows preview for fuzzy results', () => {
    const output = formatOutput(sampleFuzzyResults, 'detailed');

    expect(output).toContain('Preview content here');
  });

  test('default mode is detailed', () => {
    const detailedOutput = formatOutput(sampleResults, 'detailed');
    const defaultOutput = formatOutput(sampleResults, 'default');

    // Both should have detailed formatting
    expect(defaultOutput).toContain('Full context here');
  });

  test('handles empty results', () => {
    const output = formatOutput([], 'compact');
    expect(output).toBe('');
  });

  test('handles frontmatter with object values', () => {
    const results = [{
      file: 'test.md',
      frontmatter: { tags: ['a', 'b'] },
      preview: 'Preview'
    }];

    const output = formatOutput(results, 'detailed');
    expect(output).toContain('tags: ["a","b"]');
  });
});
