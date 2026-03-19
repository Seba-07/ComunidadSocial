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

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render a text line as HTML, detecting headings (ALL CAPS lines)
 */
function renderTextLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return '';
  const isHeading = /^[A-ZÁÉÍÓÚÑÜ\s\-:]+$/.test(trimmed) && trimmed.length < 80;
  if (isHeading) {
    return `<p style="font-weight:700;font-size:12pt;margin:14px 0 6px;text-align:center;">${escapeHtml(trimmed)}</p>`;
  }
  return `<p style="margin:4px 0;text-align:justify;line-height:1.6;">${escapeHtml(trimmed)}</p>`;
}

/**
 * Convert parsed template blocks + optional header/footer config into a
 * self-contained HTML string suitable for display in a new window or iframe.
 *
 * @param {string} templateContent - Resolved template text (placeholders already replaced)
 * @param {Object} [options]
 * @param {Object} [options.headerConfig] - { text, subtitle, imageUrl, height, showColorBar, backgroundColor }
 * @param {Object} [options.footerConfig] - { text, subtitle, imageUrl, height, showColorBar, backgroundColor }
 * @param {string} [options.pageSize] - 'letter' or 'legal'
 * @returns {string} Complete HTML document string
 */
export function templateToHtml(templateContent, options = {}) {
  const { headerConfig, footerConfig, pageSize = 'letter' } = options;
  const blocks = parseTemplateBlocks(templateContent);

  // Build header HTML — prefer imageDataUrl (base64, permanent) over imageUrl (presigned, expires)
  let headerHtml = '';
  if (headerConfig && (headerConfig.text || headerConfig.imageDataUrl || headerConfig.imageUrl)) {
    const bgColor = headerConfig.backgroundColor || '#0891b2';
    const barHtml = headerConfig.showColorBar !== false
      ? `<div style="height:4px;background:${bgColor};margin-bottom:8px;"></div>` : '';
    const imgSrc = headerConfig.imageDataUrl || headerConfig.imageUrl;
    const imgHtml = imgSrc
      ? `<img src="${imgSrc}" style="max-height:${(headerConfig.height || 60) - 10}px;max-width:200px;object-fit:contain;" />` : '';
    const textHtml = headerConfig.text
      ? `<div style="text-align:center;"><strong style="font-size:13pt;">${escapeHtml(headerConfig.text)}</strong>${headerConfig.subtitle ? `<br/><span style="font-size:10pt;color:#555;">${escapeHtml(headerConfig.subtitle)}</span>` : ''}</div>` : '';
    headerHtml = `<div style="margin-bottom:16px;">${barHtml}<div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:8px 0;">${imgHtml}${textHtml}</div></div>`;
  }

  // Build footer HTML — prefer imageDataUrl (base64, permanent) over imageUrl (presigned, expires)
  let footerHtml = '';
  if (footerConfig && (footerConfig.text || footerConfig.imageDataUrl || footerConfig.imageUrl)) {
    const bgColor = footerConfig.backgroundColor || '#0891b2';
    const barHtml = footerConfig.showColorBar !== false
      ? `<div style="height:3px;background:${bgColor};margin-bottom:6px;"></div>` : '';
    const imgSrc = footerConfig.imageDataUrl || footerConfig.imageUrl;
    const imgHtml = imgSrc
      ? `<img src="${imgSrc}" style="max-height:30px;max-width:150px;object-fit:contain;" />` : '';
    const textHtml = footerConfig.text
      ? `<span style="font-size:8pt;color:#666;">${escapeHtml(footerConfig.text)}</span>` : '';
    footerHtml = `<div style="margin-top:32px;padding-top:8px;border-top:1px solid #e5e7eb;">${barHtml}<div style="display:flex;align-items:center;justify-content:center;gap:12px;">${imgHtml}${textHtml}</div></div>`;
  }

  // Build body from blocks
  const bodyParts = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      const lines = block.content.split('\n');
      for (const line of lines) {
        bodyParts.push(renderTextLine(line));
      }
    } else if (block.type === 'cols') {
      const colWidth = Math.floor(100 / block.count);
      const colsHtml = block.columns.map(col => {
        const lines = col.split('\n').map(l => renderTextLine(l)).join('');
        return `<div style="flex:1;min-width:0;padding:0 8px;">${lines}</div>`;
      }).join('');
      bodyParts.push(`<div style="display:flex;gap:8px;margin:12px 0;">${colsHtml}</div>`);
    } else if (block.type === 'table') {
      const ths = block.headers.map(h => `<th style="border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;font-size:9pt;font-weight:600;text-align:left;">${escapeHtml(h)}</th>`).join('');
      const trs = block.rows.map(row => {
        const tds = row.map(cell => `<td style="border:1px solid #d1d5db;padding:5px 10px;font-size:9pt;">${escapeHtml(cell)}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      bodyParts.push(`<table style="width:100%;border-collapse:collapse;margin:12px 0;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`);
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@media screen { body { max-width: 800px; margin: 20px auto; padding: 40px; box-shadow: 0 1px 6px rgba(0,0,0,.1); border-radius: 4px; } }
@media print { body { margin: 0; padding: 20mm; max-width: 100%; box-shadow: none; } }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #374151; line-height: 1.6; background: white; }
table { page-break-inside: auto; }
tr { page-break-inside: avoid; }
</style></head><body>${headerHtml}${bodyParts.join('')}${footerHtml}</body></html>`;
}
