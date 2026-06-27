import { google } from 'googleapis';
import { Readable } from 'node:stream';

const requiredEnv = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'GOOGLE_DRIVE_FOLDER_ID',
];

function validateEnv() {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return `Missing environment variables: ${missing.join(', ')}`;
  }
  return '';
}

function createDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image payload.');
  }

  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  return { buffer, mimeType };
}

function getFileExtension(mimeType) {
  const mappedExtensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };

  return mappedExtensions[mimeType] || 'bin';
}

function getFileExtensionFromName(fileName) {
  const match = fileName?.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function buildUploadFileName(fileName, originalFileName, mimeType) {
  const sourceName = originalFileName || fileName || 'wedding-moment';
  const extension = getFileExtensionFromName(sourceName) || getFileExtension(mimeType);
  const safeBaseName = sourceName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'wedding-moment';

  return `${safeBaseName}.${extension}`;
}

function formatUploadError(error) {
  const googleError = error?.response?.data?.error || error?.message || '';
  if (String(googleError).includes('invalid_grant')) {
    return {
      status: 401,
      message:
        'Google OAuth refresh token is invalid or revoked. Regenerate GOOGLE_OAUTH_REFRESH_TOKEN and update .env.upload.',
    };
  }

  return {
    status: 500,
    message: error?.message || 'Failed to upload media to Google Drive.',
  };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const envError = validateEnv();
    if (envError) {
      return res.status(500).json({ error: envError });
    }

    const body = await readJsonBody(req);
    const { imageDataUrl, fileName, originalFileName, mimeType: providedMimeType } = body || {};
    if (!imageDataUrl) {
      return res.status(400).json({ error: 'imageDataUrl is required.' });
    }

    const { buffer, mimeType: inferredMimeType } = dataUrlToBuffer(imageDataUrl);
    const mimeType = providedMimeType || inferredMimeType;
    const drive = createDriveClient();

    const uploadFileName = buildUploadFileName(
      fileName || `wedding-moment-${new Date().toISOString().replace(/[:.]/g, '-')}`,
      originalFileName,
      mimeType,
    );

    const upload = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: uploadFileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType,
        body: Readable.from([buffer]),
      },
      fields: 'id,name,webViewLink',
    });

    return res.status(200).json({
      success: true,
      fileId: upload.data.id,
      fileName: upload.data.name,
      webViewLink: upload.data.webViewLink || null,
    });
  } catch (error) {
    const uploadError = formatUploadError(error);
    return res.status(uploadError.status).json({
      error: uploadError.message,
    });
  }
}
