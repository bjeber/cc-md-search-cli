#!/usr/bin/env bun

import { Command } from 'commander';
import { readFileSync, readdirSync, statSync, realpathSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import Fuse from 'fuse.js';

const program = new Command();

// Recursively find all markdown files
function findMarkdownFiles(dir, baseDir = dir) {
  let files = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(findMarkdownFiles(fullPath, baseDir));
    } else if (item.endsWith('.md') || item.endsWith('.markdown')) {
      files.push({
        path: fullPath,
        relativePath: relative(baseDir, fullPath)
      });
    }
  }

  return files;
}

// Find markdown files from multiple directories
function findMarkdownFilesFromDirs(directories) {
  let allFiles = [];
  for (const dir of directories) {
    try {
      const files = findMarkdownFiles(dir, dir);
      // Prefix relative paths with directory name for multi-dir scenarios
      const prefixedFiles = directories.length > 1
        ? files.map(f => ({
            path: f.path,
            relativePath: join(dir, f.relativePath)
          }))
        : files;
      allFiles = allFiles.concat(prefixedFiles);
    } catch (err) {
      console.error(`Error reading directory '${dir}': ${err.message}`);
    }
  }
  return allFiles;
}

// Parse markdown file with frontmatter
function parseMarkdownFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  return {
    filePath,
    frontmatter,
    body,
    fullContent: content
  };
}

// Extract all headings from markdown
function extractHeadings(lines) {
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i
      });
    }
  }
  return headings;
}

// Find nearest parent heading for a line
function findParentHeading(headings, lineIndex) {
  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].line < lineIndex) {
      return headings[i];
    }
  }
  return null;
}

// Build heading path (e.g., "## Setup > ### Prerequisites")
function buildHeadingPath(headings, lineIndex) {
  const path = [];
  let currentLevel = 7;
  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].line < lineIndex && headings[i].level < currentLevel) {
      path.unshift(`${'#'.repeat(headings[i].level)} ${headings[i].text}`);
      currentLevel = headings[i].level;
    }
  }
  return path.join(' > ');
}

// Extract smart context (paragraph boundaries, preserve code blocks)
function extractSmartContext(lines, matchIndex) {
  let start = matchIndex;
  let end = matchIndex;

  // Check if we're inside a code block
  let inCodeBlock = false;
  let codeBlockStart = -1;
  for (let i = 0; i <= matchIndex; i++) {
    if (lines[i].startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) codeBlockStart = i;
    }
  }

  if (inCodeBlock) {
    // Find code block boundaries
    start = codeBlockStart;
    for (let i = matchIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('```')) {
        end = i;
        break;
      }
    }
  } else {
    // Find paragraph boundaries (blank lines)
    for (let i = matchIndex - 1; i >= 0; i--) {
      if (lines[i].trim() === '' || lines[i].match(/^#{1,6}\s/)) {
        start = i + 1;
        break;
      }
      start = i;
    }
    for (let i = matchIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '' || lines[i].match(/^#{1,6}\s/)) {
        end = i - 1;
        break;
      }
      end = i;
    }
  }

  return { start, end };
}

// Filter frontmatter to useful fields
const USEFUL_FRONTMATTER = ['title', 'description', 'tags', 'category', 'summary', 'keywords'];

function filterFrontmatter(frontmatter) {
  const filtered = {};
  for (const key of USEFUL_FRONTMATTER) {
    if (frontmatter[key] !== undefined) {
      filtered[key] = frontmatter[key];
    }
  }
  return filtered;
}

// Get section content by heading
function extractSection(lines, headings, headingText) {
  // Support heading path like "Installation > Prerequisites"
  const pathParts = headingText.split('>').map(p => p.trim().replace(/^#+\s*/, ''));
  const targetHeading = pathParts[pathParts.length - 1].toLowerCase();

  let startIdx = -1;
  let startLevel = 0;

  for (const h of headings) {
    if (h.text.toLowerCase().includes(targetHeading)) {
      startIdx = h.line;
      startLevel = h.level;
      break;
    }
  }

  if (startIdx === -1) return null;

  // Find end (next heading of same or higher level)
  let endIdx = lines.length;
  for (const h of headings) {
    if (h.line > startIdx && h.level <= startLevel) {
      endIdx = h.line;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n');
}

// Grep-style search
function grepSearch(files, query, options) {
  const results = [];
  const regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');

  for (const file of files) {
    const parsed = parseMarkdownFile(file.path);
    const lines = parsed.body.split('\n');
    const headings = extractHeadings(lines);
    const matches = [];
    const processedRanges = []; // For deduplication

    lines.forEach((line, index) => {
      if (regex.test(line)) {
        const { start, end } = options.raw
          ? { start: Math.max(0, index - options.context), end: Math.min(lines.length - 1, index + options.context) }
          : extractSmartContext(lines, index);

        // Skip if this range overlaps with already processed
        const overlaps = processedRanges.some(r =>
          (start >= r.start && start <= r.end) || (end >= r.start && end <= r.end)
        );

        if (!overlaps) {
          processedRanges.push({ start, end });
          matches.push({
            lineNumber: index + 1,
            line: line.trim(),
            headingPath: options.raw ? null : buildHeadingPath(headings, index),
            context: lines.slice(start, end + 1).join('\n'),
            range: { start: start + 1, end: end + 1 }
          });
        }
      }
    });

    if (matches.length > 0) {
      results.push({
        file: file.relativePath,
        matches,
        frontmatter: options.raw ? parsed.frontmatter : filterFrontmatter(parsed.frontmatter)
      });
    }
  }

  return results;
}

// Fuzzy search for finding relevant documents
function fuzzySearch(files, query, options) {
  const documents = files.map(file => {
    const parsed = parseMarkdownFile(file.path);
    return {
      file: file.relativePath,
      title: parsed.frontmatter.title || file.relativePath,
      body: parsed.body,
      frontmatter: parsed.frontmatter,
      tags: parsed.frontmatter.tags || [],
      description: parsed.frontmatter.description || ''
    };
  });

  const fuse = new Fuse(documents, {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'description', weight: 1.5 },
      { name: 'body', weight: 1 },
      { name: 'tags', weight: 1.5 }
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
    useExtendedSearch: true
  });

  const results = fuse.search(query);

  return results.slice(0, options.limit).map((result, index) => {
    // Adaptive preview length based on rank
    const previewLength = options.raw ? 200 :
      index < 3 ? 600 :
      index < 7 ? 300 : 150;

    // Prefer description over body truncation
    let preview = result.item.description || '';
    if (preview.length < previewLength) {
      preview = result.item.body.substring(0, previewLength);
    }
    if (preview.length >= previewLength) {
      preview = preview.substring(0, previewLength).replace(/\s+\S*$/, '') + '...';
    }

    return {
      file: result.item.file,
      score: result.score,
      title: result.item.title,
      frontmatter: options.raw ? result.item.frontmatter : filterFrontmatter(result.item.frontmatter),
      preview
    };
  });
}

// Format output
function formatOutput(results, mode) {
  if (mode === 'json') {
    return JSON.stringify(results, null, 2);
  }

  if (mode === 'files') {
    return results.map(r => r.file).join('\n');
  }

  if (mode === 'compact') {
    return results.map(r => {
      let output = `\n📄 ${r.file}`;
      if (r.score !== undefined) {
        output += ` (relevance: ${(1 - r.score).toFixed(2)})`;
      }
      if (r.matches) {
        output += `\n   ${r.matches.length} match(es)`;
        r.matches.slice(0, 3).forEach(m => {
          if (m.headingPath) {
            output += `\n   ┌ ${m.headingPath}`;
          }
          output += `\n   │ Line ${m.lineNumber}: ${m.line.substring(0, 100)}${m.line.length > 100 ? '...' : ''}`;
        });
      } else if (r.preview) {
        output += `\n   ${r.preview}`;
      }
      return output;
    }).join('\n');
  }

  // Default: detailed
  return results.map(r => {
    let output = `\n${'─'.repeat(60)}\n📄 ${r.file}\n${'─'.repeat(60)}`;

    if (r.frontmatter && Object.keys(r.frontmatter).length > 0) {
      output += '\n' + Object.entries(r.frontmatter)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' | ');
    }

    if (r.matches) {
      r.matches.forEach(m => {
        if (m.headingPath) {
          output += `\n\n◆ ${m.headingPath} (lines ${m.range.start}-${m.range.end})`;
        }
        output += `\n${m.context}`;
      });
    } else if (r.preview) {
      output += `\n\n${r.preview}`;
    }

    return output;
  }).join('\n');
}

// Main CLI
program
  .name('ccmds')
  .description('Claude Code Markdown Search - CLI for efficient document querying')
  .version('1.0.0');

program
  .command('grep')
  .description('Search for exact text patterns (regex supported)')
  .argument('<query>', 'Search query (regex pattern)')
  .argument('[directories...]', 'Directories to search (default: current directory)')
  .option('-c, --context <lines>', 'Lines of context around matches', '2')
  .option('-s, --case-sensitive', 'Case sensitive search', false)
  .option('-o, --output <mode>', 'Output mode: detailed, compact, files, json', 'compact')
  .option('-r, --raw', 'Disable smart context (use line-based context)', false)
  .action((query, directories, options) => {
    const dirs = directories.length ? directories : ['.'];
    const files = findMarkdownFilesFromDirs(dirs);
    const results = grepSearch(files, query, {
      context: parseInt(options.context),
      caseSensitive: options.caseSensitive,
      raw: options.raw
    });

    console.log(formatOutput(results, options.output));
    console.log(`\n✓ Found ${results.length} file(s) with matches`);
  });

program
  .command('find')
  .description('Fuzzy search for relevant documents')
  .argument('<query>', 'Search query')
  .argument('[directories...]', 'Directories to search (default: current directory)')
  .option('-l, --limit <number>', 'Maximum results to return', '10')
  .option('-o, --output <mode>', 'Output mode: detailed, compact, files, json', 'compact')
  .option('-r, --raw', 'Disable adaptive previews and frontmatter filtering', false)
  .action((query, directories, options) => {
    const dirs = directories.length ? directories : ['.'];
    const files = findMarkdownFilesFromDirs(dirs);
    const results = fuzzySearch(files, query, {
      limit: parseInt(options.limit),
      raw: options.raw
    });

    console.log(formatOutput(results, options.output));
    console.log(`\n✓ Found ${results.length} relevant document(s)`);
  });

program
  .command('list')
  .description('List all markdown files')
  .argument('[directories...]', 'Directories to search (default: current directory)')
  .option('-c, --count', 'Show only count', false)
  .action((directories, options) => {
    const dirs = directories.length ? directories : ['.'];
    const files = findMarkdownFilesFromDirs(dirs);

    if (options.count) {
      console.log(files.length);
    } else {
      files.forEach(f => console.log(f.relativePath));
    }
  });

program
  .command('show')
  .description('Show full content of a markdown file')
  .argument('<file>', 'File path')
  .option('-f, --frontmatter-only', 'Show only frontmatter', false)
  .option('-b, --body-only', 'Show only body content', false)
  .action((file, options) => {
    const parsed = parseMarkdownFile(file);

    if (options.frontmatterOnly) {
      console.log(JSON.stringify(parsed.frontmatter, null, 2));
    } else if (options.bodyOnly) {
      console.log(parsed.body);
    } else {
      console.log(parsed.fullContent);
    }
  });

program
  .command('outline')
  .description('Show document structure (headings only)')
  .argument('[paths...]', 'File or directory paths (default: current directory)')
  .option('-d, --depth <number>', 'Maximum heading depth', '6')
  .option('-o, --output <mode>', 'Output mode: text, json', 'text')
  .action((paths, options) => {
    const maxDepth = parseInt(options.depth);
    const targetPaths = paths.length ? paths : ['.'];

    for (const targetPath of targetPaths) {
      try {
        const stat = statSync(targetPath);

        if (stat.isFile()) {
          const parsed = parseMarkdownFile(targetPath);
          const lines = parsed.body.split('\n');
          const headings = extractHeadings(lines).filter(h => h.level <= maxDepth);

          if (options.output === 'json') {
            console.log(JSON.stringify({ file: targetPath, headings }, null, 2));
          } else {
            console.log(`📄 ${targetPath}`);
            headings.forEach(h => {
              console.log(`${'  '.repeat(h.level - 1)}${'#'.repeat(h.level)} ${h.text}`);
            });
          }
        } else {
          const files = findMarkdownFiles(targetPath, targetPath);
          files.forEach(file => {
            const parsed = parseMarkdownFile(file.path);
            const lines = parsed.body.split('\n');
            const headings = extractHeadings(lines).filter(h => h.level <= maxDepth);
            // Prefix with directory when multiple paths
            const displayPath = targetPaths.length > 1 ? join(targetPath, file.relativePath) : file.relativePath;

            if (options.output === 'json') {
              console.log(JSON.stringify({ file: displayPath, headings }));
            } else {
              console.log(`\n📄 ${displayPath}`);
              headings.forEach(h => {
                console.log(`${'  '.repeat(h.level - 1)}${'#'.repeat(h.level)} ${h.text}`);
              });
            }
          });
        }
      } catch (err) {
        console.error(`Error reading path '${targetPath}': ${err.message}`);
      }
    }
  });

program
  .command('section')
  .description('Extract a specific section by heading')
  .argument('<file>', 'Markdown file path')
  .argument('<heading>', 'Heading text or path (e.g., "Installation" or "Setup > Prerequisites")')
  .option('-o, --output <mode>', 'Output mode: text, json', 'text')
  .action((file, heading, options) => {
    const parsed = parseMarkdownFile(file);
    const lines = parsed.body.split('\n');
    const headings = extractHeadings(lines);
    const sectionContent = extractSection(lines, headings, heading);

    if (!sectionContent) {
      console.error(`Section "${heading}" not found in ${file}`);
      process.exit(1);
    }

    if (options.output === 'json') {
      console.log(JSON.stringify({
        file,
        heading,
        content: sectionContent
      }, null, 2));
    } else {
      console.log(sectionContent);
    }
  });

// Only parse if running directly (not imported for testing)
// Support both Bun (import.meta.main) and Node.js (compare URLs)
const isMainModule = () => {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};

if (isMainModule()) {
  program.parse();
}

// Export for testing
export {
  findMarkdownFiles,
  findMarkdownFilesFromDirs,
  parseMarkdownFile,
  extractHeadings,
  findParentHeading,
  buildHeadingPath,
  extractSmartContext,
  filterFrontmatter,
  extractSection,
  grepSearch,
  fuzzySearch,
  formatOutput,
  program,
  USEFUL_FRONTMATTER
};
