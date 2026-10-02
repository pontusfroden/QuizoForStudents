/** Parse quoted CSV/TSV, including delimiters and newlines inside a quoted cell. */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0];
  const separator = delimiter ?? (firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && character === separator) {
      row.push(cell.trim());
      cell = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}
