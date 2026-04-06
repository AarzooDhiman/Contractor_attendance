/**
 * GET  /api/compliance-files?company=XYZ
 *   Lists all files in the company's compliance folder.
 *
 * DELETE /api/compliance-files?company=XYZ&file=filename.pdf
 *   Permanently deletes a single file from the company's compliance folder.
 */
import fs from 'fs';
import path from 'path';

function safeFolder(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'Unknown';
}

function getFolder(company) {
  const excelPath = (process.env.EXCEL_FILE_PATH || '').replace(/^['"]|['"]$/g, '');
  const baseDir   = excelPath ? path.dirname(path.resolve(excelPath)) : process.cwd();
  return path.join(baseDir, 'Contractor Compliances', safeFolder(company.trim()));
}

export default function handler(req, res) {
  const { company, file } = req.query;

  if (!company || !company.trim()) {
    return res.status(400).json({ success: false, message: 'company parameter required' });
  }

  // ── GET: list files ───────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const folder = getFolder(company);

      if (!fs.existsSync(folder)) {
        return res.status(200).json({ success: true, files: [] });
      }

      const entries = fs.readdirSync(folder, { withFileTypes: true });
      const files   = entries
        .filter((e) => e.isFile())
        .map((e) => ({
          name:     e.name,
          serveUrl: `/api/compliance-serve?company=${encodeURIComponent(company.trim())}&file=${encodeURIComponent(e.name)}`,
          isPdf:    e.name.toLowerCase().endsWith('.pdf'),
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); // newest first

      return res.status(200).json({ success: true, files });
    } catch (err) {
      console.error('Compliance files list error:', err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }

  // ── DELETE: remove a single file ──────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!file || !file.trim()) {
      return res.status(400).json({ success: false, message: 'file parameter required' });
    }

    // Prevent path traversal — only allow plain filenames
    const safeFile = path.basename(file);
    if (safeFile !== file) {
      return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }

    try {
      const folder   = getFolder(company);
      const filePath = path.join(folder, safeFile);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found.' });
      }

      fs.unlinkSync(filePath);
      return res.status(200).json({ success: true, message: `${safeFile} deleted.` });
    } catch (err) {
      console.error('Compliance files delete error:', err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
