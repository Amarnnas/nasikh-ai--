import React, { useRef, useState } from 'react';

interface ImageUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onFilesSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200
        ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}
      `}
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
      </div>
    </div>
  );
};