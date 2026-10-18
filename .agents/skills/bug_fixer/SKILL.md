---
name: bug-fixer
description: Reads the bugs_found.md report and automatically applies fixes to the code, validating that the application compiles without errors.
---

# Bug Fixer Skill Guidelines

Use this skill to systematically ingest `bugs_found.md` and apply modifications to the code to fix the issues listed.

## Bug Fixing Rules

1. **Verify Before and After**:
   - Before making a fix, check the context around the target code to make sure it matches the description in the bug report.
   - Use standard editing tools (`replace_file_content` or `multi_replace_file_content`). Do not overwrite files unless absolutely necessary.
   - Preserve existing unrelated code, comments, docstrings, and structures.

2. **Database Integrity**:
   - When updating SQLite operations, ensure parameter bindings remain correct and types align with the DB schema definitions.
   - Check if database schema migrations or default data insertion logic need updates if a structural database bug is resolved.

3. **React Native / styling correctness**:
   - When fixing styling issues, make sure they are responsive and use variables from the theme provider when possible.
   - Ensure you do not break other layouts or components sharing the same style rules.

4. **Update Status**:
   - After a bug is fixed, mark it as resolved in `bugs_found.md` by prefixing the title with `[Fixed]` or checking off any list items.
   - If a fix is skipped or fails, note it in the report with the reason.
