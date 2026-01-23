import { describe, test, expect } from 'bun:test';
import { extractSection, extractHeadings } from '../src/cli.js';

// ============================================================================
// SECTION EXTRACTION
// ============================================================================

describe('extractSection', () => {
  test('extracts section by heading text', () => {
    const lines = [
      '# Main',
      'Intro',
      '## Section One',
      'Section one content.',
      '## Section Two',
      'Section two content.'
    ];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'Section One');
    expect(section).toContain('## Section One');
    expect(section).toContain('Section one content.');
    expect(section).not.toContain('Section two');
  });

  test('extracts section including nested headings', () => {
    const lines = [
      '# Main',
      '## Parent',
      'Parent content.',
      '### Child',
      'Child content.',
      '## Sibling',
      'Sibling content.'
    ];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'Parent');
    expect(section).toContain('## Parent');
    expect(section).toContain('### Child');
    expect(section).toContain('Child content.');
    expect(section).not.toContain('Sibling');
  });

  test('returns null when heading not found', () => {
    const lines = ['# Only Heading', 'Content'];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'Nonexistent');
    expect(section).toBeNull();
  });

  test('handles heading path input', () => {
    const lines = [
      '# Main',
      '## Setup',
      '### Prerequisites',
      'You need X.',
      '### Steps',
      'Step 1.'
    ];
    const headings = extractHeadings(lines);

    // Should find Prerequisites from path
    const section = extractSection(lines, headings, 'Setup > Prerequisites');
    expect(section).toContain('### Prerequisites');
    expect(section).toContain('You need X.');
    expect(section).not.toContain('Steps');
  });

  test('extracts to end of file', () => {
    const lines = [
      '# Main',
      '## Last Section',
      'Final content.',
      'More final content.'
    ];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'Last Section');
    expect(section).toContain('Final content.');
    expect(section).toContain('More final content.');
  });

  test('handles case insensitive matching', () => {
    const lines = [
      '# UPPER CASE',
      'Content here.'
    ];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'upper case');
    expect(section).toContain('# UPPER CASE');
  });
});
