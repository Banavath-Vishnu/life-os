/**
 * Lightweight note markdown (no dependencies).
 *
 * Supported, one per line:
 *   # / ## / ###      headings
 *   - [ ] / - [x]     todos (tappable in view mode)
 *   - item / * item   bullets
 *   1. item           numbered list
 *   > text            quote
 *   ```               code block (fenced, multi-line)
 *   ---               divider
 * Inline: **bold**, *italic*, `code`, ~~strike~~
 */

const TODO_RE = /^(\s*)[-*] \[( |x|X)\] (.*)$/;
const HEADING_RE = /^(#{1,3}) (.*)$/;
const BULLET_RE = /^(\s*)[-*] (.*)$/;
const NUMBERED_RE = /^(\s*)(\d+)[.)] (.*)$/;
const QUOTE_RE = /^> ?(.*)$/;
const DIVIDER_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const FENCE_RE = /^```/;

/**
 * Splits note text into display blocks. Each block keeps the source line index
 * so view-mode actions (ticking a todo) can edit the original text.
 */
export function parseNoteBlocks(text) {
  const lines = (text || '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (FENCE_RE.test(line.trim())) {
      const codeLines = [];
      const start = i;
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n'), line: start });
      i++; // skip closing fence (or end of text)
      continue;
    }

    let m;
    if ((m = line.match(TODO_RE))) {
      blocks.push({ type: 'todo', checked: m[2].toLowerCase() === 'x', text: m[3], indent: m[1].length, line: i });
    } else if ((m = line.match(HEADING_RE))) {
      blocks.push({ type: `h${m[1].length}`, text: m[2], line: i });
    } else if (DIVIDER_RE.test(line.trim())) {
      blocks.push({ type: 'divider', line: i });
    } else if ((m = line.match(BULLET_RE))) {
      blocks.push({ type: 'bullet', text: m[2], indent: m[1].length, line: i });
    } else if ((m = line.match(NUMBERED_RE))) {
      blocks.push({ type: 'numbered', number: m[2], text: m[3], indent: m[1].length, line: i });
    } else if ((m = line.match(QUOTE_RE))) {
      blocks.push({ type: 'quote', text: m[1], line: i });
    } else if (line.trim() === '') {
      blocks.push({ type: 'blank', line: i });
    } else {
      blocks.push({ type: 'paragraph', text: line, line: i });
    }
    i++;
  }
  return blocks;
}

/** Ticks/unticks the todo on the given source line. */
export function toggleTodoLine(text, lineIndex) {
  const lines = (text || '').split('\n');
  const m = lines[lineIndex] && lines[lineIndex].match(TODO_RE);
  if (!m) return text;
  const checked = m[2].toLowerCase() === 'x';
  lines[lineIndex] = `${m[1]}- [${checked ? ' ' : 'x'}] ${m[3]}`;
  return lines.join('\n');
}

/** Splits a line into inline runs: { text, bold, italic, code, strike }. */
export function parseInline(text) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) runs.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith('~~')) runs.push({ text: tok.slice(2, -2), strike: true });
    else if (tok.startsWith('`')) runs.push({ text: tok.slice(1, -1), code: true });
    else runs.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

/** Plain-text preview for note cards (no markdown symbols). */
export function notePreviewText(text) {
  return (text || '')
    .split('\n')
    .filter((l) => !FENCE_RE.test(l.trim()) && !DIVIDER_RE.test(l.trim()))
    .map((l) => {
      const todo = l.match(TODO_RE);
      if (todo) return `${todo[2].toLowerCase() === 'x' ? '☑' : '☐'} ${todo[3]}`;
      return l
        .replace(HEADING_RE, '$2')
        .replace(QUOTE_RE, '$1')
        .replace(BULLET_RE, '$1• $2')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/`([^`]+)`/g, '$1');
    })
    .filter((l) => l.trim() !== '')
    .join('\n');
}

/** Todo progress for a note, e.g. { done: 2, total: 5 } (null when it has no todos). */
export function noteTodoProgress(text) {
  const todos = (text || '').split('\n').map((l) => l.match(TODO_RE)).filter(Boolean);
  if (todos.length === 0) return null;
  return { done: todos.filter((m) => m[2].toLowerCase() === 'x').length, total: todos.length };
}

// ---------------- Editor helpers (operate on text + selection) ----------------

const LINE_PREFIXES = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  todo: '- [ ] ',
  bullet: '- ',
  numbered: '1. ',
  quote: '> ',
};

// Any existing block prefix, so switching e.g. bullet -> todo replaces instead of stacking
const ANY_PREFIX_RE = /^(#{1,3} |[-*] \[[ xX]\] |[-*] |\d+[.)] |> )/;

/**
 * Applies a line style to every line touched by the selection.
 * Applying the same style again removes it (toggle). Returns { text, selection }.
 */
export function applyLineStyle(text, selection, style) {
  const prefix = LINE_PREFIXES[style];
  const start = text.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
  let end = text.indexOf('\n', selection.end);
  if (end === -1) end = text.length;

  const lines = text.slice(start, end).split('\n');
  const allHaveStyle = lines.every((l) => l.startsWith(prefix) && (style !== 'bullet' || !TODO_RE.test(l)));
  let n = 0;
  const updated = lines.map((l) => {
    const bare = l.replace(ANY_PREFIX_RE, '');
    if (allHaveStyle) return bare;
    n++;
    return (style === 'numbered' ? `${n}. ` : prefix) + bare;
  });
  const replaced = updated.join('\n');
  const newText = text.slice(0, start) + replaced + text.slice(end);
  const cursor = start + replaced.length;
  return { text: newText, selection: { start: cursor, end: cursor } };
}

/** Wraps the selection (or inserts a placeholder) with inline markers like ** or `. */
export function applyInlineStyle(text, selection, marker, placeholder) {
  const selected = text.slice(selection.start, selection.end);
  const inner = selected || placeholder;
  const newText = text.slice(0, selection.start) + marker + inner + marker + text.slice(selection.end);
  const innerStart = selection.start + marker.length;
  return { text: newText, selection: { start: innerStart, end: innerStart + inner.length } };
}

/** Inserts a code block or divider on its own lines at the cursor. */
export function insertBlock(text, selection, kind) {
  const before = text.slice(0, selection.start);
  const after = text.slice(selection.end);
  const lead = before.length === 0 || before.endsWith('\n') ? '' : '\n';
  const trail = after.startsWith('\n') ? '' : '\n';
  if (kind === 'divider') {
    const insert = `${lead}---${trail}`;
    const cursor = before.length + insert.length;
    return { text: before + insert + after, selection: { start: cursor, end: cursor } };
  }
  // code block: cursor lands inside the fence (selected code stays inside it)
  const selected = text.slice(selection.start, selection.end);
  const insert = `${lead}\`\`\`\n${selected}\n\`\`\`${trail}`;
  const inside = before.length + lead.length + 4;
  return { text: before + insert + after, selection: { start: inside, end: inside + selected.length } };
}

/**
 * Applies a NoteToolbar action to the text at the given selection.
 * Returns { text, selection } or null for an unknown tool.
 */
export function applyNoteTool(text, selection, tool) {
  const sel = {
    start: Math.min(selection.start, text.length),
    end: Math.min(selection.end, text.length),
  };
  if (['h1', 'h2', 'h3', 'todo', 'bullet', 'numbered', 'quote'].includes(tool)) return applyLineStyle(text, sel, tool);
  if (tool === 'bold') return applyInlineStyle(text, sel, '**', 'bold text');
  if (tool === 'italic') return applyInlineStyle(text, sel, '*', 'italic text');
  if (tool === 'strike') return applyInlineStyle(text, sel, '~~', 'text');
  if (tool === 'code') return applyInlineStyle(text, sel, '`', 'code');
  if (tool === 'codeblock') return insertBlock(text, sel, 'code');
  if (tool === 'divider') return insertBlock(text, sel, 'divider');
  return null;
}
