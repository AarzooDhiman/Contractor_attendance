/**
 * Excel file helper using exceljs.
 *
 * Reads and writes a local .xlsx file directly.
 * If the file lives in your OneDrive folder, it syncs automatically.
 *
 * Set EXCEL_FILE_PATH in .env.local to the full path of your .xlsx file.
 * e.g. EXCEL_FILE_PATH=/Users/you/OneDrive/ContractorLog.xlsx
 */
import ExcelJS from 'exceljs';
import path from 'path';

const SHEET = 'ContractorLog';

// Column order defines the spreadsheet structure.
// Each question has its own dedicated column.
const COLUMNS = [
  'Date',
  'Company Name',
  'Operative Name',
  'ID Number',
  'Buildings',
  'Point of Contact',
  'Contact Number',
  'RAMS Submitted',
  'Declaration Confirmed',
  'Sign-In Time',
  'Sign-Out Time',
  'Work Completed',
  'Status',
  'Photo URL',
];

function getFilePath() {
  let p = process.env.EXCEL_FILE_PATH;
  if (!p) throw new Error('EXCEL_FILE_PATH is not set in .env.local');
  // Strip surrounding quotes if present (e.g. EXCEL_FILE_PATH='/path/...')
  p = p.replace(/^['"]|['"]$/g, '');
  return path.resolve(p);
}

// ── Simple write lock — prevents concurrent writes corrupting the file ────────
let writeLock = Promise.resolve();
function withLock(fn) {
  writeLock = writeLock.then(fn).catch(fn);
  return writeLock;
}

// ── Ensure the workbook and sheet exist, creating them if needed ──────────────
async function load() {
  const filePath = getFilePath();
  const wb = new ExcelJS.Workbook();

  const fileExists = (await import('fs')).existsSync(filePath);

  if (fileExists) {
    await wb.xlsx.readFile(filePath);
  }

  let ws = wb.getWorksheet(SHEET);

  if (!ws) {
    // Sheet missing (or brand-new file) — create it with styled headers
    ws = wb.addWorksheet(SHEET);
    const WIDE_COLS = new Set(['Buildings', 'RAMS Submitted', 'Work Completed', 'Photo URL']);
    ws.columns = COLUMNS.map((col) => ({ header: col, key: col, width: WIDE_COLS.has(col) ? 45 : 22 }));

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    headerRow.height = 20;
    headerRow.commit();

    await wb.xlsx.writeFile(filePath);
    console.log(`[excel] Created sheet "${SHEET}" in ${filePath}`);
  }

  return { wb, ws };
}

// ── Row object → array in column order ───────────────────────────────────────
function rowToValues(rowData) {
  return COLUMNS.map((col) => rowData[col] ?? '');
}

// ── Array → row object ────────────────────────────────────────────────────────
function valuesToRow(arr, excelRowNumber) {
  const obj = { _row: excelRowNumber };
  COLUMNS.forEach((col, i) => {
    obj[col] = arr[i] ?? '';
  });
  return obj;
}

// ── Read all data rows (skips header row 1) ───────────────────────────────────
export async function getAllRows() {
  const { ws } = await load();
  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const values = row.values.slice(1); // exceljs row.values is 1-indexed, slice off index 0
    rows.push(valuesToRow(values, rowNumber));
  });
  return rows;
}

// ── Append a new sign-in row ──────────────────────────────────────────────────
export async function appendRow(rowData) {
  return withLock(async () => {
    const { wb, ws } = await load();
    ws.addRow(rowToValues(rowData));
    await wb.xlsx.writeFile(getFilePath());
  });
}

// ── Update a row by its Excel row number ─────────────────────────────────────
export async function updateRow(excelRowNumber, updates) {
  return withLock(async () => {
    const { wb, ws } = await load();
    const row = ws.getRow(excelRowNumber);

    COLUMNS.forEach((col, i) => {
      if (updates[col] !== undefined) {
        row.getCell(i + 1).value = updates[col];
      }
    });

    row.commit();
    await wb.xlsx.writeFile(getFilePath());
  });
}

// ── Find the active session for an ID on a given date ────────────────────────
export async function findActiveSession(idNumber, todayDate) {
  const rows = await getAllRows();
  return rows.find(
    (r) =>
      String(r['ID Number']).trim() === String(idNumber).trim() &&
      r['Status'] === 'Active' &&
      r['Date'] === todayDate
  ) ?? null;
}

// ── Get rows for a specific date (optionally filtered by company) ─────────────
export async function getRowsByDate(date, company) {
  const rows = await getAllRows();
  return rows.filter((r) => {
    if (r['Date'] !== date) return false;
    if (company && !r['Company Name'].toLowerCase().includes(company.toLowerCase())) return false;
    return true;
  });
}
