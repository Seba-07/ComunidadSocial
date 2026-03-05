/**
 * Template Block Parser
 * Parses template text (after placeholder replacement) into typed blocks
 * for rendering in both HTML preview and jsPDF PDF generation.
 *
 * Supported blocks:
 *   [COLS:N]...[COL]...[/COLS]  — N-column layout, [COL] separates columns
 *   [TABLE]...[/TABLE]          — Table with | separator, first row = headers
 *   Plain text                  — Everything else
 */

/**
 * @typedef {{ type: 'text', content: string }} TextBlock
 * @typedef {{ type: 'cols', count: number, columns: string[] }} ColsBlock
 * @typedef {{ type: 'table', headers: string[], rows: string[][] }} TableBlock
 * @typedef {TextBlock | ColsBlock | TableBlock} TemplateBlock
 */

/**
 * Parse template text into an array of typed blocks.
 * @param {string} text - Resolved template text (placeholders already replaced)
 * @returns {TemplateBlock[]}
 */
export function parseTemplateBlocks(text) {
  if (!text) return [{ type: 'text', content: '' }];

  const blocks = [];
  const lines = text.split('\n');
  let i = 0;
  let textBuffer = [];

  function flushText() {
    if (textBuffer.length > 0) {
      blocks.push({ type: 'text', content: textBuffer.join('\n') });
      textBuffer = [];
    }
  }

  while (i < lines.length) {
    const colMatch = lines[i].match(/^\[COLS:(\d)\]\s*$/);
    const tableMatch = /^\[TABLE\]\s*$/.test(lines[i]);

    if (colMatch) {
      flushText();
      const count = parseInt(colMatch[1], 10);
      const innerLines = [];
      i++;
      while (i < lines.length && !/^\[\/COLS\]\s*$/.test(lines[i])) {
        innerLines.push(lines[i]);
        i++;
      }
      // Split by [COL] delimiter to get each column's content
      const rawContent = innerLines.join('\n');
      const columns = rawContent.split(/\n?\[COL\]\n?/).map(c => c.trim());
      // Pad to expected count
      while (columns.length < count) columns.push('');
      blocks.push({ type: 'cols', count, columns: columns.slice(0, count) });
      i++; // skip [/COLS]
    } else if (tableMatch) {
      flushText();
      const tableLines = [];
      i++;
      while (i < lines.length && !/^\[\/TABLE\]\s*$/.test(lines[i])) {
        const trimmed = lines[i].trim();
        if (trimmed) tableLines.push(trimmed);
        i++;
      }
      if (tableLines.length > 0) {
        const headers = tableLines[0].split('|').map(s => s.trim());
        const rows = tableLines.slice(1).map(line =>
          line.split('|').map(s => s.trim())
        );
        blocks.push({ type: 'table', headers, rows });
      }
      i++; // skip [/TABLE]
    } else {
      textBuffer.push(lines[i]);
      i++;
    }
  }

  flushText();
  return blocks;
}
