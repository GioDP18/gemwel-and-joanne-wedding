import { useEffect, useRef, useState } from 'react';
import './CameraPage.css';

const UPLOAD_API_PATH = '/api/upload-wedding-photo';
const LOCAL_UPLOAD_SERVER_ORIGIN = 'http://localhost:8787';
const FILE_INPUT_ID = 'camera-upload-input';
const MAX_UPLOAD_DIMENSION = 1920;
const JPEG_QUALITY = 0.86;

function resolveUploadEndpoint() {
  const configuredBase = import.meta.env.VITE_UPLOAD_API_BASE_URL?.trim();
  if (configuredBase) {
    return `${configuredBase.replace(/\/$/, '')}${UPLOAD_API_PATH}`;
  }

  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${LOCAL_UPLOAD_SERVER_ORIGIN}${UPLOAD_API_PATH}`;
  }

  return UPLOAD_API_PATH;
}

async function parseResponsePayload(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function loadImageFromObjectUrl(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image.'));
    img.src = objectUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function prepareImageDataUrl(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const { width, height } = image;
    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to prepare image for upload.');

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareUploadItem(file) {
  if (file.type.startsWith('image/')) {
    return {
      id: crypto.randomUUID(),
      name: file.name,
      originalName: file.name,
      mimeType: 'image/jpeg',
      dataUrl: await prepareImageDataUrl(file),
    };
  }

  if (file.type.startsWith('video/')) {
    return {
      id: crypto.randomUUID(),
      name: file.name,
      originalName: file.name,
      mimeType: file.type,
      dataUrl: await readFileAsDataUrl(file),
    };
  }

  throw new Error(`Unsupported file type for ${file.name}.`);
}

export default function CameraPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const uploadEndpointRef = useRef(resolveUploadEndpoint());
  const [capturedImage, setCapturedImage] = useState('');
  const [uploadItems, setUploadItems] = useState([]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera is not supported in this browser.');
      return;
    }

    stopCamera();
    try {
      const candidates = [
        { video: { facingMode: { exact: 'environment' } }, audio: false },
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false },
      ];

      let stream = null;
      for (const constraint of candidates) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          break;
        } catch {
          // Keep trying fallbacks until one camera is available.
        }
      }

      if (!stream) {
        throw new Error('No camera is available on this device.');
      }

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMessage('');
    } catch {
      setMessage('Camera access was blocked. Please allow camera permission and reload.');
    }
  };

  const stopCamera = () => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    setUploadItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `captured-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
        originalName: `captured-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
        mimeType: 'image/jpeg',
        dataUrl,
      },
    ]);
    setMessage('');
    stopCamera();
  };

  const retakePhoto = async () => {
    setCapturedImage('');
    setStatus('idle');
    setMessage('');
    await startCamera();
  };

  const addFiles = async (files) => {
    const supportedFiles = Array.from(files).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (!supportedFiles.length) {
      setMessage('Please choose image or video files only.');
      setStatus('error');
      return;
    }

    try {
      const newItems = await Promise.all(supportedFiles.map((file) => prepareUploadItem(file)));
      setUploadItems((prev) => [...prev, ...newItems]);
      const uploadLabel = newItems.length > 1 ? 'files' : 'file';
      setMessage(`${newItems.length} ${uploadLabel} added.`);
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to prepare selected media.');
    }
  };

  const onFileInputChange = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    await addFiles(files);
    event.target.value = '';
  };

  const sendPhotos = async () => {
    if (!uploadItems.length) return;
    const endpoint = uploadEndpointRef.current;
    setStatus('uploading');
    setMessage(`Uploading ${uploadItems.length} file${uploadItems.length > 1 ? 's' : ''}...`);

    try {
      for (const item of uploadItems) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageDataUrl: item.dataUrl,
            fileName: item.name,
            originalFileName: item.originalName,
            mimeType: item.mimeType,
          }),
        });

        const payload = await parseResponsePayload(response);
        if (!response.ok) {
          if ([502, 503, 504].includes(response.status)) {
            throw new Error(
              'Upload server is unavailable. Start it with "npm run dev:upload" or run "npm run dev:all".',
            );
          }
          throw new Error(
            payload?.error || payload?.message || `Upload failed for ${item.name} (HTTP ${response.status})`,
          );
        }
      }

      setStatus('success');
      setMessage('All uploads saved to Google Drive successfully.');
      setUploadItems([]);
    } catch (error) {
      setStatus('error');
      if (error?.name === 'TypeError' && /fetch/i.test(error.message || '')) {
        setMessage(
          `Unable to reach the upload server at ${endpoint}. Run "npm run dev:upload" alongside the app, or set VITE_UPLOAD_API_BASE_URL if the backend is hosted elsewhere.`,
        );
      } else {
        setMessage(error.message || 'Failed to upload media.');
      }
    }
  };

  return (
    <main className="camera-page">
      {status === 'uploading' ? (
        <div className="camera-uploading-overlay" role="status" aria-live="polite" aria-label="Uploading photos">
          <div className="vertical-centered-box">
            <div className="content">
              <div className="loader-circle" />
              <div className="loader-line-mask">
                <div className="loader-line" />
              </div>
              <img src="/assets/images/preloader.gif" alt="" />
            </div>
            <p className="camera-uploading-text">Uploading photos</p>
          </div>
        </div>
      ) : null}
      <section className="camera-card">
        <h1>Wedding Moment Camera</h1>
        <p>Capture or upload special memories and save them to your wedding Drive folder.</p>

        <div className="camera-frame">
          {!capturedImage ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : (
            <img src={capturedImage} alt="Captured wedding moment" />
          )}
          <canvas ref={canvasRef} className="camera-canvas" />
        </div>

        <div
          className={`camera-dropzone${isDragActive ? ' is-active' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={async (event) => {
            event.preventDefault();
            setIsDragActive(false);
            if (event.dataTransfer?.files?.length) {
              await addFiles(event.dataTransfer.files);
            }
          }}
        >
          <p>Drag and drop images or videos here, or use Upload Media.</p>
        </div>

        <div className="camera-actions">
          {!capturedImage ? (
            <button type="button" className="camera-btn primary" onClick={capturePhoto}>
              Capture
            </button>
          ) : (
            <button
              type="button"
              className="camera-btn secondary"
              onClick={retakePhoto}
              disabled={status === 'uploading'}
            >
              Re-take
            </button>
          )}
          <label htmlFor={FILE_INPUT_ID} className="camera-btn secondary camera-upload-label">
            Upload Media
          </label>
          <input
            id={FILE_INPUT_ID}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onFileInputChange}
            className="camera-upload-input"
          />
          <button
            type="button"
            className="camera-btn primary"
            onClick={sendPhotos}
            disabled={status === 'uploading' || uploadItems.length === 0}
          >
            {status === 'uploading' ? 'Sending...' : `Send ${uploadItems.length || ''}`.trim()}
          </button>
        </div>

        {uploadItems.length ? (
          <ul className="camera-upload-list">
            {uploadItems.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        ) : null}

        {message ? <p className={`camera-message ${status}`}>{message}</p> : null}
      </section>
    </main>
  );
}
