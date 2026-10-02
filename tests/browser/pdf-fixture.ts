// A tiny text PDF fixture, assembled with valid byte offsets rather than a remote test file.
export function pdfFixture(blank = false): Buffer {
  const content = blank
    ? ''
    : 'BT /F1 12 Tf 50 760 Td (Momentum is the product of the mass and velocity of a moving object.) Tj 0 -24 Td (Energy is the capacity of a system to do work or transfer heat.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}
export function mixedPdfFixture(
  image: Buffer,
  width: number,
  height: number,
  options: { encoding?: 'jpeg' | 'jpx' | 'ccitt'; blankPages?: number } = {},
): Buffer {
  const objects: Buffer[] = [];
  const add = (data: string | Buffer) => {
    objects.push(typeof data === 'string' ? Buffer.from(data) : data);
    return objects.length;
  };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const text =
    'BT /F1 12 Tf 50 760 Td (Energy is the capacity of a system to do work or transfer heat.) Tj ET';
  const textStream = add(`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
  const firstPage = add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${textStream} 0 R >>`,
  );
  const imageObject = add(
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ${
          options.encoding === 'ccitt'
            ? `/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode /DecodeParms << /K -1 /Columns ${width} /Rows ${height} >>`
            : `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${options.encoding === 'jpx' ? 'JPXDecode' : 'DCTDecode'}`
        } /Length ${image.length} >>\nstream\n`,
      ),
      image,
      Buffer.from('\nendstream'),
    ]),
  );
  const draw = 'q 612 0 0 792 0 0 cm /Scan Do Q';
  const imageStream = add(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  const secondPage = add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Scan ${imageObject} 0 R >> >> /Contents ${imageStream} 0 R >>`,
  );
  const blankStream = add('<< /Length 0 >>\nstream\n\nendstream');
  const blankPages = Array.from({ length: options.blankPages ?? 1 }, () =>
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents ${blankStream} 0 R >>`,
    ),
  );
  const pages = [firstPage, secondPage, ...blankPages];
  objects[1] = Buffer.from(
    `<< /Type /Pages /Kids [${pages.map((page) => `${page} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  const pieces = [Buffer.from('%PDF-1.4\n')];
  const offsets: number[] = [];
  let length = pieces[0].length;
  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      object,
      Buffer.from('\nendobj\n'),
    ]);
    pieces.push(chunk);
    length += chunk.length;
  }
  pieces.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(pieces);
}
