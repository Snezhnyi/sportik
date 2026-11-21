import * as XLSX from 'xlsx';
import type { SheetInput } from './parseTable';

/** Reads .xlsx / .xls / .ods / .csv into plain rows per sheet. */
export async function readSpreadsheet(file: File): Promise<SheetInput[]> {
  const buf = await file.arrayBuffer();
  return readSpreadsheetBuffer(buf, file.name);
}

export function readSpreadsheetBuffer(buf: ArrayBuffer | Uint8Array, fileName: string): SheetInput[] {
  const isCsv = /\.csv$/i.test(fileName);
  const wb = isCsv
    ? XLSX.read(decodeCsv(buf), { type: 'string', raw: true })
    : XLSX.read(buf, { type: 'array', cellDates: false });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[name], {
      header: 1,
      raw: false,
      defval: null,
      blankrows: true,
    }),
  }));
}

/** CSV exported from Russian Excel is often Windows-1251 and uses ';' — handle both. */
function decodeCsv(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('�')) text = new TextDecoder('windows-1251').decode(bytes);
  return text.replace(/^﻿/, '');
}
