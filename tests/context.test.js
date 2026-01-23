import { describe, test, expect } from 'bun:test';
import { extractSmartContext } from '../src/cli.js';

// ============================================================================
// CONTEXT EXTRACTION
// ============================================================================

describe('extractSmartContext', () => {
  test('extracts paragraph boundaries', () => {
    const lines = [
      'First paragraph.',
      '',
      'Second paragraph line 1.',
      'Second paragraph line 2.',
      '',
      'Third paragraph.'
    ];

    const { start, end } = extractSmartContext(lines, 2);
    expect(start).toBe(2);
    expect(end).toBe(3);
  });

  test('extracts full code block when match inside', () => {
    const lines = [
      'Before code',
      '```javascript',
      'const x = 1;',
      'const keyword = "test";',
      '```',
      'After code'
    ];

    const { start, end } = extractSmartContext(lines, 3);
    expect(start).toBe(1);  // Code block start
    expect(end).toBe(4);    // Code block end
  });

  test('handles unclosed code block', () => {
    const lines = [
      'Before',
      '```bash',
      'echo "unclosed"',
      'keyword here',
      'more content'
    ];

    const { start, end } = extractSmartContext(lines, 3);
    expect(start).toBe(1);  // Code block start
    // When code block is not closed, end stays at match position
    expect(end).toBe(3);
  });

  test('stops at heading', () => {
    const lines = [
      '# Heading',
      'Paragraph content.',
      'More content.',
      '## Next Heading',
      'Different section.'
    ];

    const { start, end } = extractSmartContext(lines, 1);
    expect(start).toBe(1);
    expect(end).toBe(2);
  });

  test('handles match at start of file', () => {
    const lines = [
      'First line with match.',
      'Second line.',
      '',
      'New paragraph.'
    ];

    const { start, end } = extractSmartContext(lines, 0);
    expect(start).toBe(0);
    expect(end).toBe(1);
  });

  test('handles match at end of file', () => {
    const lines = [
      '',
      'Middle content.',
      '',
      'Last paragraph.'
    ];

    const { start, end } = extractSmartContext(lines, 3);
    expect(start).toBe(3);
    expect(end).toBe(3);
  });

  test('extends to previous lines when no boundary before match', () => {
    // No blank line or heading before match - should extend to start
    const lines = [
      'First line.',
      'Second line.',
      'Third line with match.',
      '',
      'Next paragraph.'
    ];

    const { start, end } = extractSmartContext(lines, 2);
    expect(start).toBe(0);  // Should extend back to start
    expect(end).toBe(2);    // Should stop before blank line
  });
});
