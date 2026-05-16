import { useEffect, useRef, useState } from 'react';
import './CameraPage.css';

const API_ENDPOINT = '/api/upload-wedding-photo';

export default function CameraPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMessage('');
    } catch (_error) {
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
    setMessage('');
    stopCamera();
  };

  const retakePhoto = async () => {
    setCapturedImage('');
    setStatus('idle');
    setMessage('');
    await startCamera();
  };

  const sendPhoto = async () => {
    if (!capturedImage) return;
    setStatus('uploading');
    setMessage('Uploading photo to Google Drive...');

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageDataUrl: capturedImage,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Upload failed');
      }

      setStatus('success');
      setMessage('Photo saved to Google Drive successfully.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to upload photo.');
    }
  };

  return (
    <main className="camera-page">
      <section className="camera-card">
        <h1>Wedding Moment Camera</h1>
        <p>Capture a special memory and save it to your wedding Drive folder.</p>

        <div className="camera-frame">
          {!capturedImage ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : (
            <img src={capturedImage} alt="Captured wedding moment" />
          )}
          <canvas ref={canvasRef} className="camera-canvas" />
        </div>

        {!capturedImage ? (
          <button type="button" className="camera-btn primary" onClick={capturePhoto}>
            Capture
          </button>
        ) : (
          <div className="camera-actions">
            <button
              type="button"
              className="camera-btn primary"
              onClick={sendPhoto}
              disabled={status === 'uploading'}
            >
              {status === 'uploading' ? 'Sending...' : 'Send'}
            </button>
            <button
              type="button"
              className="camera-btn secondary"
              onClick={retakePhoto}
              disabled={status === 'uploading'}
            >
              Re-take
            </button>
          </div>
        )}

        {message ? <p className={`camera-message ${status}`}>{message}</p> : null}
      </section>
    </main>
  );
}
