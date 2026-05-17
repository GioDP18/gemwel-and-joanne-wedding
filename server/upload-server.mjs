import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import { Readable } from 'node:stream';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.upload' });

const app = express();
const port = process.env.UPLOAD_SERVER_PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

app.post('/api/upload-wedding-photo', async (req, res) => {
  try {
    const envError = validateEnv();
    if (envError) {
      return res.status(500).json({ error: envError });
    }

    const { imageDataUrl } = req.body || {};
    if (!imageDataUrl) {
      return res.status(400).json({ error: 'imageDataUrl is required.' });
    }

    const { buffer, mimeType } = dataUrlToBuffer(imageDataUrl);
    const drive = createDriveClient();

    const now = new Date();
    const fileName = `wedding-moment-${now.toISOString().replace(/[:.]/g, '-')}.jpg`;

    const upload = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id,name,webViewLink',
    });

    return res.json({
      success: true,
      fileId: upload.data.id,
      fileName: upload.data.name,
      webViewLink: upload.data.webViewLink || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Failed to upload image to Google Drive.',
    });
  }
});

app.use((error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Uploaded image is too large. Please try a smaller image.',
    });
  }

  return next(error);
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Upload server running on http://localhost:${port}`);
});
