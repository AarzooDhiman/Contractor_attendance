/**
 * POST /api/compliance-update   (multipart/form-data)
 *
 * Fields:
 *   companyName    string   required
 *   ramsDate       string   YYYY-MM-DD  optional
 *   inductionDate  string   YYYY-MM-DD  optional
 *   insuranceDate  string   YYYY-MM-DD  optional
 *   managerName    string   optional
 *   document       file(s)  optional — multiple files accepted at any time
 *
 * Files are saved to:
 *   <EXCEL_FILE_DIR>/Contractor Compliances/<Company Name>/<timestamp>_<original filename>
 *
 * The Excel column "Document Path" stores the company folder path so the
 * compliance-files API can list all documents for that company at any time.
 */
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { upsertComplianceRow, getComplianceForCompany } from '../../lib/excel';
import { ukDateTimeString } from '../../lib/ukTime';

export const config = { api: { bodyParser: false } };

/** Add months to a YYYY-MM-DD string, returns YYYY-MM-DD or '' */
function addMonths(dateStr, months) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

/** Sanitise a company name so it is safe to use as a folder name */
function safeFolder(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'Unknown';
}

/** Returns the absolute path of the company's compliance folder, creating it if needed */
function getCompanyFolder(companyName) {
  const excelPath = (process.env.EXCEL_FILE_PATH || '').replace(/^['"]|['"]$/g, '');
  const baseDir   = excelPath ? path.dirname(path.resolve(excelPath)) : process.cwd();
  const folder    = path.join(baseDir, 'Contractor Compliances', safeFolder(companyName));
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

/** Save a single formidable file object into the company folder. Returns destination path. */
function saveFile(docFile, companyFolder) {
  const safeName    = (docFile.originalFilename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename    = `${Date.now()}_${safeName}`;
  const destination = path.join(companyFolder, filename);
  fs.copyFileSync(docFile.filepath, destination);
  return destination;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Allow multiple files with the same field name
  const form = new IncomingForm({ maxFileSize: 50 * 1024 * 1024, multiples: true });
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to parse form data.' });
  }

  const get = (k) => Array.isArray(fields[k]) ? fields[k][0] : (fields[k] || '');

  const companyName   = get('companyName').trim();
  const ramsDate      = get('ramsDate');
  const inductionDate = get('inductionDate');
  const insuranceDate = get('insuranceDate');
  const managerName   = get('managerName');

  // Normalise to array — handles single file, multiple files, or none
  const docFiles = (Array.isArray(files.document) ? files.document : (files.document ? [files.document] : []))
    .filter((f) => f && f.size > 0);

  if (!companyName) {
    return res.status(400).json({ success: false, message: 'Company name is required.' });
  }

  try {
    const existing      = await getComplianceForCompany(companyName);
    const companyFolder = getCompanyFolder(companyName);

    // ── Save every uploaded file into the company folder ──────────────────────
    let savedCount = 0;
    for (const docFile of docFiles) {
      try {
        saveFile(docFile, companyFolder);
        savedCount++;
      } finally {
        if (docFile.filepath && fs.existsSync(docFile.filepath)) {
          try { fs.unlinkSync(docFile.filepath); } catch { /* ignore */ }
        }
      }
    }

    // ── Merge: only update dates that were explicitly provided ────────────────
    const finalRams      = ramsDate      || existing?.['RAMS Date']      || '';
    const finalInduction = inductionDate || existing?.['Induction Date'] || '';
    const finalInsurance = insuranceDate || existing?.['Insurance Date'] || '';

    await upsertComplianceRow(companyName, {
      'Company Name':     companyName,
      'RAMS Date':        finalRams,
      'Induction Date':   finalInduction,
      'Insurance Date':   finalInsurance,
      'RAMS Expiry':      addMonths(finalRams, 6),
      'Induction Expiry': addMonths(finalInduction, 12),
      'Insurance Expiry': addMonths(finalInsurance, 12),
      // Store folder path so compliance-files API can always list all docs
      'Document Path':    companyFolder,
      'Updated By':       managerName,
      'Updated At':       ukDateTimeString(),
    });

    const parts = [];
    if (finalRams || finalInduction || finalInsurance) parts.push('Dates saved.');
    if (savedCount > 0) parts.push(`${savedCount} file${savedCount > 1 ? 's' : ''} uploaded.`);

    return res.status(200).json({
      success: true,
      message: `Compliance updated for ${companyName}. ${parts.join(' ')}`.trim(),
      folderPath: companyFolder,
      savedCount,
    });
  } catch (err) {
    console.error('Compliance update error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
      detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}
