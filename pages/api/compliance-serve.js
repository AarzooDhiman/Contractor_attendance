/**
 * GET /api/compliance-serve?company=XYZ&file=filename.pdf
 *
 * Streams a compliance document from the local folder to the browser.
 * PDFs open inline; images are displayed inline; other types are downloaded.
 */
import fs from 'fs';
import path from 'path';

const MIME = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
};

function safeFolder(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'Unknown';
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { company, file } = req.query;

  if (!company || !file) {
    return res.status(400).json({ message: 'company and file parameters required' });
  }

  // Prevent path traversal — only allow simple filenames (no slashes)
  const safeFile = path.basename(file);
  if (safeFile !== file) {
    return res.status(400).json({ message: 'Invalid filename.' });
  }

  try {
    const excelPath = (process.env.EXCEL_FILE_PATH || '').replace(/^['"]|['"]$/g, '');
    const baseDir   = excelPath ? path.dirname(path.resolve(excelPath)) : process.cwd();
    const filePath  = path.join(baseDir, 'Contractor Compliances', safeFolder(company), safeFile);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const ext      = path.extname(safeFile).toLowerCase();
    const mimeType = MIME[ext] || 'application/octet-stream';
    const stat     = fs.statSync(filePath);
    const isInline = !!MIME[ext]; // known types open inline; unknown types prompt download

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${safeFile}"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error('Compliance serve error:', err);
    res.status(500).end();
  }
}
