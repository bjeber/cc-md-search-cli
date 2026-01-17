# Markdown Search CLI Skill - Configuration Template

## ⚙️ CONFIGURATION - EDIT THIS SECTION

**IMPORTANT: Set your documentation path here before using this skill:**

```
DOCS_PATH="./your-docs-folder-here"
```

Replace `./your-docs-folder-here` with the actual path to your documentation.

### Common Configuration Examples:

```bash
# Single docs folder:
DOCS_PATH="./docs"

# Project-specific:
DOCS_PATH="./my-project-docs"

# Documentation subfolder:
DOCS_PATH="./documentation/markdown"

# Nested in project:
DOCS_PATH="./src/docs"
```

### Project-Specific Paths (Optional):

If you have documentation scattered across multiple locations, you can define additional paths:

```bash
# Additional paths (optional)
WEB_DOCS_PATH="./web-app/docs"
API_DOCS_PATH="./api/docs"
CMS_DOCS_PATH="./cms/docs"
```

### Auto-Search Behavior:

When configured, Claude Code will **automatically search** the configured `DOCS_PATH` when the user asks questions about:
- Setup, installation, configuration
- API endpoints, usage
- Architecture, design decisions
- Troubleshooting, debugging
- Guides, tutorials, how-tos
- Any project documentation

**No need to ask** - just search immediately using the configured path.

---

## 📋 Quick Start Checklist

Before using this skill:
- [ ] Replace `./your-docs-folder-here` with your actual docs path
- [ ] Verify the path exists: `ls ./your-docs-folder-here`
- [ ] Test the search: `ccmds list ./your-docs-folder-here`
- [ ] (Optional) Configure additional project-specific paths
- [ ] Save this file to your Claude Code skills directory

---

Once configured, see the full SKILL.md file for:
- Complete command reference
- Workflow strategies
- Output mode selection
- Best practices
- Example interactions

**After configuration, copy the configured DOCS_PATH to the main SKILL.md file.**