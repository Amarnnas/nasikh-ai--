import React, { useRef, useState, useCallback, useEffect } from 'react';

interface ImageUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

const SCAN_SERVER = 'http://localhost:57575';

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onFilesSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<'unknown' | 'ready' | 'no_scanner' | 'offline'>('unknown');
  const [scannerName, setScannerName] = useState('');

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(s);
      setShowCamera(true);
    } catch {
      scannerInputRef.current?.click();
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setShowCamera(false);
  }, [stream]);

  useEffect(() => {
    if (showCamera && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [showCamera, stream]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onFilesSelected([file]);
      stopCamera();
    }, 'image/jpeg', 0.95);
  };

  const checkScanner = () => {
    fetch(`${SCAN_SERVER}/status`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then(d => {
        if (d.status === 'ok') {
          setScannerStatus('ready');
          setScannerName(d.name || 'Scanner');
        } else {
          setScannerStatus('no_scanner');
          setScannerName(d.detail || '');
        }
      })
      .catch(() => setScannerStatus('offline'));
  };

  useEffect(() => { checkScanner(); }, []);

  const scanFromPrinter = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${SCAN_SERVER}/scan`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.step === 'done') {
              const blob = await (await fetch(data.image)).blob();
              const file = new File([blob], `scanner_${Date.now()}.jpg`, { type: 'image/jpeg' });
              onFilesSelected([file]);
              setScanning(false);
              return;
            }
            if (data.step === 'error') {
              alert(data.message || 'Scan failed');
              setScanning(false);
              return;
            }
          } catch {}
        }
      }
    } catch (e: any) {
      alert(`Scanner not reachable. Make sure scan-server is running.\n\n${e.message}`);
    }
    setScanning(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((file: File) => 
        file.type.startsWith('image/') || file.type === 'application/pdf'
      );
      onFilesSelected(validFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = Array.from(e.target.files).filter((file: File) => 
        file.type.startsWith('image/') || file.type === 'application/pdf'
      );
      onFilesSelected(validFiles);
      e.target.value = '';
    }
  };

  return (
    <>
      <div className="relative border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-200 cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={isDragging ? { borderColor: '#4f46e5', backgroundColor: '#eef2ff' } : {}}
      >
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-700">اضغط للإضافة أو اسحب الصور وملفات PDF هنا</p>
            <p className="text-sm text-slate-500 mt-1">يدعم JPG, PNG, WEBP, PDF (يمكنك رفع ملفات متعددة)</p>
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); startCamera(); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              تصوير مباشر بالكاميرا
            </button>
            <div className="flex flex-col items-center gap-1">
              <button type="button" disabled={scanning || scannerStatus !== 'ready'} onClick={(e) => { e.stopPropagation();
                scanFromPrinter();
              }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                {scanning ? 'جاري المسح...' : 'مسح ضوئي (Scanner)'}
              </button>
              {scannerStatus === 'offline' && (
                <span className="text-[11px] text-amber-600">شغّل scan-server على جهازك للاستخدام المباشر
                  <button onClick={(e) => { e.stopPropagation(); checkScanner(); }} className="mr-1 underline hover:text-amber-800">إعادة محاولة</button>
                </span>
              )}
              {scannerStatus === 'unknown' && (
                <span className="text-[11px] text-slate-400">جاري الاتصال بالسكانر...</span>
              )}
              {scannerStatus === 'no_scanner' && (
                <span className="text-[11px] text-red-500" title={'معلومات إضافية: ' + scannerName}>لم يتم العثور على سكانر
                  <button onClick={(e) => { e.stopPropagation(); checkScanner(); }} className="mr-1 underline hover:text-red-700">إعادة فحص</button>
                </span>
              )}
              {scannerStatus === 'ready' && (
                <span className="text-[11px] text-green-600">{scannerName || 'السكانر'} جاهز</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <video ref={videoRef} autoPlay playsInline className="max-w-full max-h-[80vh] object-contain" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-4 mt-4">
            <button onClick={capturePhoto} className="px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              التقاط
            </button>
            <button onClick={stopCamera} className="px-6 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-colors">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </>
  );
};