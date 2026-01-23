import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { join } from 'path';
import { program } from '../src/cli.js';
import { FIXTURES_DIR, NESTED_DIR, SECOND_DOCS_DIR } from './helpers/index.js';

// ============================================================================
// CLI COMMANDS
// ============================================================================

describe('CLI Commands', () => {
  let originalLog;
  let logOutput;
  let originalError;
  let errorOutput;
  let originalExit;

  beforeAll(() => {
    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;

    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };
    console.error = (...args) => {
      errorOutput.push(args.join(' '));
    };
    process.exit = (code) => {
      throw new Error(`Process.exit(${code})`);
    };
  });

  afterAll(() => {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  });

  beforeEach(() => {
    logOutput = [];
    errorOutput = [];
  });

  describe('grep command', () => {
    test('basic grep search', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'content', FIXTURES_DIR]);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('grep with context option', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'test', FIXTURES_DIR, '-c', '3']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('grep with case-sensitive flag', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'Test', FIXTURES_DIR, '-s']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('grep with raw flag', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'content', FIXTURES_DIR, '-r']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('grep with json output', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'test', FIXTURES_DIR, '-o', 'json']);

      // JSON is the first output, followed by "Found X file(s)" message
      const jsonLine = logOutput.find(line => line.startsWith('['));
      expect(jsonLine).toBeDefined();
      expect(() => JSON.parse(jsonLine)).not.toThrow();
    });
  });

  describe('find command', () => {
    test('basic find search', async () => {
      await program.parseAsync(['node', 'test', 'find', 'testing', FIXTURES_DIR]);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('find with limit option', async () => {
      await program.parseAsync(['node', 'test', 'find', 'test', FIXTURES_DIR, '-l', '2']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('find with raw flag', async () => {
      await program.parseAsync(['node', 'test', 'find', 'test', FIXTURES_DIR, '-r']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('find with json output', async () => {
      await program.parseAsync(['node', 'test', 'find', 'test', FIXTURES_DIR, '-o', 'json']);

      // JSON is the first output, followed by "Found X document(s)" message
      const jsonLine = logOutput.find(line => line.startsWith('['));
      expect(jsonLine).toBeDefined();
      expect(() => JSON.parse(jsonLine)).not.toThrow();
    });
  });

  describe('list command', () => {
    test('lists all markdown files', async () => {
      await program.parseAsync(['node', 'test', 'list', FIXTURES_DIR]);

      const output = logOutput.join('\n');
      expect(output).toContain('.md');
    });

    test('list with count flag', async () => {
      await program.parseAsync(['node', 'test', 'list', FIXTURES_DIR, '-c']);

      const output = logOutput.join('\n');
      expect(parseInt(output)).toBeGreaterThan(0);
    });
  });

  describe('show command', () => {
    test('shows full file content', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'show', testFile]);

      const output = logOutput.join('\n');
      expect(output).toContain('# Main Title');
    });

    // Note: Testing -f and -b flags separately is problematic due to Commander
    // retaining option state between parseAsync calls. The flags work correctly
    // in actual CLI usage but cause state pollution in sequential test runs.
    // The functionality is tested indirectly via parseMarkdownFile tests.
  });

  describe('outline command', () => {
    test('outlines single file', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'outline', testFile]);

      const output = logOutput.join('\n');
      expect(output).toContain('# Main Title');
      expect(output).toContain('## Section');
    });

    test('outlines directory', async () => {
      await program.parseAsync(['node', 'test', 'outline', FIXTURES_DIR]);

      const output = logOutput.join('\n');
      expect(output).toContain('.md');
    });

    test('outline with depth filter', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'outline', testFile, '-d', '2']);

      const output = logOutput.join('\n');
      expect(output).toContain('## Section');
      expect(output).not.toContain('###');
    });

    test('outline with json output for file', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'outline', testFile, '-o', 'json']);

      const output = logOutput.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed.file).toBeDefined();
      expect(parsed.headings).toBeDefined();
    });

    test('outline with json output for directory', async () => {
      await program.parseAsync(['node', 'test', 'outline', FIXTURES_DIR, '-o', 'json']);

      // Each file outputs a JSON line
      const output = logOutput.join('\n');
      const lines = output.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });

  describe('section command', () => {
    test('extracts section by heading', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'section', testFile, 'Section One']);

      const output = logOutput.join('\n');
      expect(output).toContain('## Section One');
      expect(output).toContain('content in section one');
    });

    test('section with json output', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'section', testFile, 'Section One', '-o', 'json']);

      const output = logOutput.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed.file).toBeDefined();
      expect(parsed.heading).toBe('Section One');
      expect(parsed.content).toContain('## Section One');
    });

    test('section not found error', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');

      try {
        await program.parseAsync(['node', 'test', 'section', testFile, 'Nonexistent']);
      } catch (e) {
        expect(e.message).toContain('exit(1)');
      }

      const output = errorOutput.join('\n');
      expect(output).toContain('not found');
    });
  });

  // ==========================================================================
  // MULTI-DIRECTORY CLI COMMANDS
  // ==========================================================================

  describe('multi-directory support', () => {
    describe('grep with multiple directories', () => {
      test('grep searches across multiple directories', async () => {
        await program.parseAsync(['node', 'test', 'grep', 'content', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'compact']);

        const output = logOutput.join('\n');
        expect(output).toContain('Found');
      });

      test('grep returns results from both directories', async () => {
        await program.parseAsync(['node', 'test', 'grep', 'API', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'json']);

        const jsonLine = logOutput.find(line => line.startsWith('['));
        expect(jsonLine).toBeDefined();
        const results = JSON.parse(jsonLine);

        // Should find results from second-docs (api-guide.md has "API")
        // File paths are absolute paths when using multiple directories
        const hasSecondDocs = results.some(r => r.file.includes('second-docs') || r.file.includes('api-guide'));
        expect(hasSecondDocs).toBe(true);
      });
    });

    describe('find with multiple directories', () => {
      test('find searches across multiple directories', async () => {
        await program.parseAsync(['node', 'test', 'find', 'API', NESTED_DIR, SECOND_DOCS_DIR, '-l', '5']);

        const output = logOutput.join('\n');
        expect(output).toContain('Found');
      });

      test('find returns results from multiple directories', async () => {
        await program.parseAsync(['node', 'test', 'find', 'documentation', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'json']);

        const jsonLine = logOutput.find(line => line.startsWith('['));
        expect(jsonLine).toBeDefined();
        const results = JSON.parse(jsonLine);

        // Should find api-guide.md from second-docs
        expect(results.some(r => r.file.includes('api-guide'))).toBe(true);
      });
    });

    describe('list with multiple directories', () => {
      // Note: Commander retains option state between parseAsync calls.
      // The count tests are better covered in cross-runtime tests which spawn fresh processes.
      test('list count aggregates across directories', async () => {
        // Get count from each individually
        await program.parseAsync(['node', 'test', 'list', NESTED_DIR, '-c']);
        const nestedCount = parseInt(logOutput[logOutput.length - 1]);

        logOutput.length = 0;
        await program.parseAsync(['node', 'test', 'list', SECOND_DOCS_DIR, '-c']);
        const secondCount = parseInt(logOutput[logOutput.length - 1]);

        logOutput.length = 0;
        await program.parseAsync(['node', 'test', 'list', NESTED_DIR, SECOND_DOCS_DIR, '-c']);
        const combinedCount = parseInt(logOutput[logOutput.length - 1]);

        expect(combinedCount).toBe(nestedCount + secondCount);
      });
    });

    describe('outline with multiple directories', () => {
      test('outline shows structure from multiple directories', async () => {
        // Explicitly set text output mode to avoid Commander state issues
        await program.parseAsync(['node', 'test', 'outline', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'text']);

        const output = logOutput.join('\n');
        // Should include headings from both directories
        expect(output).toContain('Nested File');  // From deep.md
        expect(output).toContain('API Documentation');  // From api-guide.md
      });

      test('outline with depth filter works across multiple directories', async () => {
        // Explicitly set text output mode to avoid Commander state issues
        await program.parseAsync(['node', 'test', 'outline', NESTED_DIR, SECOND_DOCS_DIR, '-d', '1', '-o', 'text']);

        const output = logOutput.join('\n');
        // Should only show h1 headings
        expect(output).toContain('# Nested File');
        expect(output).toContain('# API Documentation');
        // Should not show h2 or deeper
        expect(output).not.toContain('## Purpose');
        expect(output).not.toContain('## Authentication');
      });
    });

    describe('default directory behavior', () => {
      test('grep defaults to current directory when no directory specified', async () => {
        // This should work without throwing (searches current dir)
        await program.parseAsync(['node', 'test', 'grep', 'nonexistentpattern12345']);
        const output = logOutput.join('\n');
        expect(output).toContain('Found 0');
      });

      test('find defaults to current directory when no directory specified', async () => {
        await program.parseAsync(['node', 'test', 'find', 'nonexistentquery12345', '-l', '1']);
        const output = logOutput.join('\n');
        expect(output).toContain('Found 0');
      }, 30000); // Longer timeout - indexes entire cwd which may have many files

      test('list defaults to current directory when no directory specified', async () => {
        await program.parseAsync(['node', 'test', 'list']);
        // Should complete without error - may or may not find files depending on cwd
        expect(true).toBe(true);
      });

      test('outline defaults to current directory when no path specified', async () => {
        await program.parseAsync(['node', 'test', 'outline']);
        // Should complete without error
        expect(true).toBe(true);
      });
    });

    describe('error handling', () => {
      test('grep continues when one directory does not exist', async () => {
        await program.parseAsync(['node', 'test', 'grep', 'API', '/nonexistent/path', SECOND_DOCS_DIR, '-o', 'compact']);

        const output = logOutput.join('\n');
        const errors = errorOutput.join('\n');

        // Should report error for non-existent dir
        expect(errors).toContain('Error reading directory');
        // Should still find results from valid directory
        expect(output).toContain('Found');
      });

      test('find continues when one directory does not exist', async () => {
        await program.parseAsync(['node', 'test', 'find', 'API', '/nonexistent/path', SECOND_DOCS_DIR, '-l', '5', '-o', 'compact']);

        const output = logOutput.join('\n');
        const errors = errorOutput.join('\n');

        // Should report error for non-existent dir
        expect(errors).toContain('Error reading directory');
        // Should still find results from valid directory
        expect(output).toContain('Found');
      });

      // Note: list with non-existent directory is tested in cross-runtime tests
      // because Commander retains the -c flag state between parseAsync calls
    });
  });
});
