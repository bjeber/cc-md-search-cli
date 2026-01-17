#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
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

// Grep-style search
function grepSearch(files, query, options) {
  const results = [];
  const regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');

  for (const file of files) {
    const parsed = parseMarkdownFile(file.path);
    const lines = parsed.body.split('\n');
    const matches = [];

    lines.forEach((line, index) => {
      if (regex.test(line)) {
        const start = Math.max(0, index - options.context);
        const end = Math.min(lines.length, index + options.context + 1);
        
        matches.push({
          lineNumber: index + 1,
          line: line.trim(),
          context: lines.slice(start, end).join('\n')
        });
      }
    });

    if (matches.length > 0) {
      results.push({
        file: file.relativePath,
        matches,
        frontmatter: parsed.frontmatter
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
      tags: parsed.frontmatter.tags || []
    };
  });

  const fuse = new Fuse(documents, {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'body', weight: 1 },
      { name: 'tags', weight: 1.5 }
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2
  });

  const results = fuse.search(query);
  return results.slice(0, options.limit).map(result => ({
    file: result.item.file,
    score: result.score,
    title: result.item.title,
    frontmatter: result.item.frontmatter,
    preview: result.item.body.substring(0, 200) + '...'
  }));
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
          output += `\n   Line ${m.lineNumber}: ${m.line.substring(0, 80)}`;
        });
      } else if (r.preview) {
        output += `\n   ${r.preview}`;
      }
      return output;
    }).join('\n');
  }

  // Default: detailed
  return results.map(r => {
    let output = `\n${'='.repeat(60)}\n📄 ${r.file}\n${'='.repeat(60)}`;
    
    if (r.frontmatter && Object.keys(r.frontmatter).length > 0) {
      output += '\n\nFrontmatter:\n' + JSON.stringify(r.frontmatter, null, 2);
    }

    if (r.matches) {
      r.matches.forEach(m => {
        output += `\n\n--- Line ${m.lineNumber} ---\n${m.context}`;
      });
    } else if (r.preview) {
      output += `\n\nPreview:\n${r.preview}`;
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
  .argument('[directory]', 'Directory to search', '.')
  .option('-c, --context <lines>', 'Lines of context around matches', '2')
  .option('-s, --case-sensitive', 'Case sensitive search', false)
  .option('-o, --output <mode>', 'Output mode: detailed, compact, files, json', 'compact')
  .action((query, directory, options) => {
    const files = findMarkdownFiles(directory);
    const results = grepSearch(files, query, {
      context: parseInt(options.context),
      caseSensitive: options.caseSensitive
    });
    
    console.log(formatOutput(results, options.output));
    console.log(`\n✓ Found ${results.length} file(s) with matches`);
  });

program
  .command('find')
  .description('Fuzzy search for relevant documents')
  .argument('<query>', 'Search query')
  .argument('[directory]', 'Directory to search', '.')
  .option('-l, --limit <number>', 'Maximum results to return', '10')
  .option('-o, --output <mode>', 'Output mode: detailed, compact, files, json', 'compact')
  .action((query, directory, options) => {
    const files = findMarkdownFiles(directory);
    const results = fuzzySearch(files, query, {
      limit: parseInt(options.limit)
    });
    
    console.log(formatOutput(results, options.output));
    console.log(`\n✓ Found ${results.length} relevant document(s)`);
  });

program
  .command('list')
  .description('List all markdown files')
  .argument('[directory]', 'Directory to search', '.')
  .option('-c, --count', 'Show only count', false)
  .action((directory, options) => {
    const files = findMarkdownFiles(directory);
    
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

program.parse();
