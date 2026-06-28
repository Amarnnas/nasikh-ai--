import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType } from "docx";
import saveAs from "file-saver";
import { ScannedImage, OcrMode } from './types';
import { extractTextFromImage } from './services/geminiService';
import { ImageUploader } from './components/ImageUploader';
import { Button } from './components/Button';
import { ResultView } from './components/ResultView';

const CONCURRENCY_LIMIT = 2;

const App: React.FC = () => {
  const [images, setImages] = useState<ScannedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingImageId, setViewingImageId] = useState<string | null>(null);
  const [ocrMode, setOcrMode] = useState<OcrMode>(OcrMode.Educational);
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    const newImages: ScannedImage[] = files.map(file => ({
      id: uuidv4(),
      file,
      previewUrl: file.type === 'application/pdf' ? '' : URL.createObjectURL(file),
      status: 'idle',
      extractedText: null
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img && img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      return prev.filter(i => i.id !== id);
    });
    if (viewingImageId === id) setViewingImageId(null);
  };

  useEffect(() => {
    if (!isProcessing) return;

    const processNextBatch = async () => {
      const activeCount = images.filter(img => img.status === 'processing').length;
      const pendingImages = images.filter(img => img.status === 'idle');

      if (activeCount === 0 && pendingImages.length === 0) {
        setIsProcessing(false);
        return;
      }

      if (activeCount < CONCURRENCY_LIMIT && pendingImages.length > 0) {
        const slotsAvailable = CONCURRENCY_LIMIT - activeCount;
        const batch = pendingImages.slice(0, slotsAvailable);

        setImages(prev => prev.map(img => 
          batch.some(b => b.id === img.id) ? { ...img, status: 'processing' } : img
        ));

        batch.forEach(async (image) => {
          try {
            const text = await extractTextFromImage(image.file, ocrMode);
            setImages(prev => prev.map(img => 
              img.id === image.id ? { ...img, status: 'success', extractedText: text } : img
            ));
          } catch (error: any) {
            setImages(prev => prev.map(img => 
              img.id === image.id ? { ...img, status: 'error', errorMessage: error.message } : img
            ));
          }
        });
      }
    };

    const interval = setInterval(processNextBatch, 500);
    return () => clearInterval(interval);
  }, [images, isProcessing, ocrMode]);

  const startProcessing = () => setIsProcessing(true);
  const clearAll = () => {
      images.forEach(img => img.previewUrl && URL.revokeObjectURL(img.previewUrl));
      setImages([]);
      setViewingImageId(null);
      setIsProcessing(false);
  }

  const handleSortByName = () => {
    setImages(prev => [...prev].sort((a, b) => a.file.name.localeCompare(b.file.name)));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
        const _images = [...images];
        const draggedItemContent = _images[dragItem.current];
        _images.splice(dragItem.current, 1);
        _images.splice(dragOverItem.current, 0, draggedItemContent);
        setImages(_images);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setIsDragging(false);
  };

  const handleExportDocx = async () => {
    const completedImages = images.filter(img => img.status === 'success' && img.extractedText);
    if (completedImages.length === 0) {
        alert("لا يوجد نصوص مكتملة للتصدير.");
        return;
    }

    const splitMarkdownTableRow = (rawLine: string) => {
        const parts = rawLine.split('|');
        if (parts.length > 2) {
            let startIndex = parts[0].trim() === "" ? 1 : 0;
            let endIndex = parts[parts.length - 1].trim() === "" ? parts.length - 1 : parts.length;
            return parts.slice(startIndex, endIndex).map(c => c.trim());
        }
        return parts.map(c => c.trim()).filter(c => c !== "");
    };

    try {
        const docChildren: any[] = [];

        completedImages.forEach((img, index) => {
            if (index > 0) docChildren.push(new Paragraph({ children: [new PageBreak()] }));
            
            docChildren.push(new Paragraph({
                 text: `--- ${img.file.name} ---`,
                 alignment: AlignmentType.CENTER,
                 heading: HeadingLevel.HEADING_3,
                 spacing: { after: 200, before: 200 },
                 bidirectional: true
            }));

            const content = img.extractedText || "";
            const lines = content.split('\n');
            let i = 0;

            while (i < lines.length) {
                const line = lines[i].trim();
                
                // Detect start of a markdown table
                if (line.startsWith('|') && i + 1 < lines.length && lines[i+1].includes('|---')) {
                    const tableRows: TableRow[] = [];
                    // Process headers
                    const headers = splitMarkdownTableRow(line);
                    tableRows.push(new TableRow({
                        children: headers.map(h => new TableCell({
                            children: [new Paragraph({ text: h, alignment: AlignmentType.CENTER, bidirectional: true })],
                            shading: { fill: "f0f0f0" }
                        }))
                    }));

                    i += 2; // Skip header and separator row
                    
                    // Process data rows
                    while (i < lines.length && lines[i].trim().startsWith('|')) {
                        const cells = splitMarkdownTableRow(lines[i]);
                        if (cells.length > 0) {
                            tableRows.push(new TableRow({
                                children: cells.map(c => new TableCell({
                                    children: [new Paragraph({ text: c, alignment: AlignmentType.RIGHT, bidirectional: true })]
                                }))
                            }));
                        }
                        i++;
                    }

                    docChildren.push(new Table({
                        rows: tableRows,
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 1 },
                            bottom: { style: BorderStyle.SINGLE, size: 1 },
                            left: { style: BorderStyle.SINGLE, size: 1 },
                            right: { style: BorderStyle.SINGLE, size: 1 },
                            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
                        }
                    }));
                    continue; // Skip the i++ at the end of while
                }

                if (!line) {
                    docChildren.push(new Paragraph({ text: "" }));
                } else {
                    let headingLevel: typeof HeadingLevel[keyof typeof HeadingLevel] | undefined = undefined;
                    let text = line;

                    if (line.startsWith('# ')) { headingLevel = HeadingLevel.HEADING_1; text = line.substring(2); }
                    else if (line.startsWith('## ')) { headingLevel = HeadingLevel.HEADING_2; text = line.substring(3); }
                    else if (line.startsWith('### ')) { headingLevel = HeadingLevel.HEADING_3; text = line.substring(4); }

                    docChildren.push(new Paragraph({
                        children: [new TextRun({ text: text, size: 24, font: "Arial" })],
                        heading: headingLevel,
                        bidirectional: true,
                        alignment: AlignmentType.RIGHT
                    }));
                }
                i++;
            }
        });

        const doc = new Document({ sections: [{ children: docChildren }] });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, "Nasikh_Combined_Output.docx");
    } catch (e) {
        console.error("Export failed", e);
        alert("فشل إنشاء ملف الورد.");
    }
  };

  const viewingImage = images.find(img => img.id === viewingImageId) || null;
  const stats = {
      total: images.length,
      completed: images.filter(i => i.status === 'success').length,
      pending: images.filter(i => i.status === 'idle' || i.status === 'processing').length
  }

  return (
    <div className="flex h-full bg-slate-50">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-indigo-200 shadow-lg">ن</div>
            <div>
                <h1 className="text-xl font-bold text-slate-800">ناسخ الذكي (Nasikh AI)</h1>
                <p className="text-xs text-slate-500">دعم الصور وPDF والجداول</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex bg-slate-100 p-1 rounded-lg ring-1 ring-slate-200">
                <button onClick={() => setOcrMode(OcrMode.Educational)} className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded-md transition-all ${ocrMode === OcrMode.Educational ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>تحليل تعليمي</button>
                <button onClick={() => setOcrMode(OcrMode.Formatting)} className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded-md transition-all ${ocrMode === OcrMode.Formatting ? 'bg-white shadow text-indigo-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>تنسيق ذكي</button>
                <button onClick={() => setOcrMode(OcrMode.Standard)} className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded-md transition-all ${ocrMode === OcrMode.Standard ? 'bg-white shadow text-indigo-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>نص عادي</button>
             </div>
             {stats.total > 0 && <div className="hidden sm:block text-sm font-medium text-slate-600">{stats.completed}/{stats.total} مكتمل</div>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <ImageUploader onFilesSelected={handleFilesSelected} />
                    {stats.total > 0 && (
                        <div className="flex flex-col md:flex-row items-center justify-between mt-6 pt-6 border-t border-slate-100 animate-fade-in gap-4">
                            <Button variant="secondary" onClick={handleSortByName} title="ترتيب أبجدياً" icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" /></svg>}>ترتيب بالاسم</Button>
                            <div className="flex gap-3 w-full md:w-auto justify-end">
                                <Button variant="ghost" onClick={clearAll} disabled={isProcessing}>مسح الكل</Button>
                                <Button variant="secondary" onClick={handleExportDocx} disabled={stats.completed === 0} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}>تصدير DOCX</Button>
                                <Button onClick={startProcessing} isLoading={isProcessing && stats.pending > 0} disabled={stats.pending === 0}>بدء التحويل</Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                    {images.map((img, index) => (
                        <div key={img.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()} onClick={() => setViewingImageId(img.id)} className={`group relative bg-white rounded-xl shadow-sm border overflow-hidden cursor-pointer transition-all hover:shadow-md active:cursor-grabbing hover:scale-[1.01] ${img.status === 'processing' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200'}`}>
                            <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="absolute top-2 left-2 z-10 bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-500 p-1.5 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                            </button>
                            <div className="aspect-[3/2] w-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                {img.file.type === 'application/pdf' ? (
                                    <div className="flex flex-col items-center text-red-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                        <span className="text-[10px] mt-1 font-bold">PDF</span>
                                    </div>
                                ) : <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover" />}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10">
                                    {img.status === 'processing' && <div className="bg-white/90 p-2 rounded-full"><svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>}
                                    {img.status === 'success' && <div className="bg-green-500/90 text-white p-2 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>}
                                </div>
                            </div>
                            <div className="p-3">
                                <p className="text-xs font-medium text-slate-700 truncate text-right" dir="ltr">{img.file.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
        {viewingImage && <ResultView selectedImage={viewingImage} onClose={() => setViewingImageId(null)} />}
      </div>
    </div>
  );
};

export default App;