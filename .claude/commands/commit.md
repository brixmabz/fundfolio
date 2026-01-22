# Git Commit with Smart Message

Commit all changes with a descriptive message based on actual changes.

Steps:
1. Run `git diff --staged` and `git diff` to see actual changes
2. Run `git status` to see new/modified files
3. Analyze the real code changes (not filenames)
4. Generate concise commit message describing what changed
5. Run `git add .`
6. Run `git commit -m "message"`

CRITICAL: Base message on actual code changes from git diff, not just filenames.

IMPORTANT: Do not include Generated with [Claude Code] and Co-Authored-By: in the commit message. This will put us both in trouble.

Message format:
- Start with verb (Add, Fix, Update, Remove, Refactor)
- Be specific about what changed
- One line, no periods

Examples:
- "Add customer endpoint with pagination"
- "Fix SQL query for agreement mappings"
- "Update OAuth2 configuration for Azure"

Usage: `claude-code commit`