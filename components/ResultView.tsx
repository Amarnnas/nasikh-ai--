import React, { useState } from 'react';
import { ScannedImage } from '../types';
import { Button } from './Button';

interface ResultViewProps {
  selectedImage: ScannedImage | null;
  onClose: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({ selectedImage, onClose }) => {
  const [copySuccess, setCopySuccess] = useState(false);

  if (!selectedImage) return null;

  const handleCopy = () => {
    if (selectedImage.extractedText) {
      navigator.clipboard.writeText(selectedImage.extractedText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-50 flex flex-col md:flex-row overflow-hidden animate-fade-in">
      {/* Left (or Right in RTL) Side: Image Preview */}
      <div className="w-full md:w-1/2 bg-slate-900 flex flex-col relative">
         <div className="absolute top-4 left-4 z-10 md:hidden">
            <Button variant="secondary" onClick={onClose} size="sm">إغلاق</Button>
         </div>
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
          <img 
            src={selectedImage.previewUrl} 
            alt="Original" 
            className="max-w-full max-h-full object-contain rounded shadow-lg"
          />
        </div>
        <div className="p-4 bg-slate-800 text-white text-sm text-center">
            {selectedImage.file.name}
        </div>
      </div>

      {/* Content Side: Text Result */}
      <div className="w-full md:w-1/2 flex flex-col h-full border-r border-slate-200 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2">
             <Button variant="ghost" onClick={onClose} className="hidden md:flex">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
             </Button>
             <h2 className="text-lg font-bold text-slate-800">النص المستخرج</h2>
          </div>
          <div className="flex gap-2">
            <Button 
                variant={copySuccess ? "secondary" : "primary"} 
                onClick={handleCopy}
                icon={
                    copySuccess ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                    )
                }
            >
              {copySuccess ? 'تم النسخ' : 'نسخ النص'}
            </Button>
          </div>
        </div>

        {/* Text Area */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {selectedImage.status === 'processing' ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p>جاري المعالجة باستخدام الذكاء الاصطناعي...</p>
             </div>
          ) : selectedImage.status === 'error' ? (
             <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008h-.008v-.008z" />
                </svg>
                <p className="text-center font-semibold">فشل استخراج النص</p>
                <p className="text-sm text-slate-500">{selectedImage.errorMessage}</p>
             </div>
          ) : (
             <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-headings:text-indigo-900" dir="auto">
                {/* We display raw text in a textarea-like styling for editing, or rendered markdown. 
                    Given user wants to "preserve formatting", a pre-wrap is safest for raw text, 
                    but rendering simple markdown helps visualize tables. 
                    Let's use a simple whitespace-pre-wrap div. 
                */}
                <pre className="whitespace-pre-wrap font-sans text-base text-slate-800">
                    {selectedImage.extractedText}
                </pre>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};