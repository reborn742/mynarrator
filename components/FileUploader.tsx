import React, { useRef } from 'react';
import { UploadCloud, FileType as FileIcon, FileText, X, Bookmark, Check } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  isParsing: boolean;
  onSave?: () => void;
  isSaved?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, selectedFile, onClearFile, isParsing, onSave, isSaved }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Validate file size (Max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      alert("File is too large. Maximum file size is 50MB.");
      return;
    }

    // Simple validation for type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (validTypes.includes(file.type) || file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt')) {
      onFileSelect(file);
    } else {
      alert("Please upload a PDF, DOCX, or TXT file.");
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (selectedFile) {
    return (
      <div className="w-full p-4 bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-xl flex items-center justify-between transition-all">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            {selectedFile.type.includes('pdf') ? <FileText size={24} /> : <FileIcon size={24} />}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate block max-w-xs">{selectedFile.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {onSave && (
                <button
                    onClick={onSave}
                    disabled={isSaved}
                    className={`
                        p-2 rounded-full transition-colors flex items-center gap-2 px-3
                        ${isSaved 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default' 
                            : 'hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'}
                    `}
                    title={isSaved ? "Saved to Library" : "Save to Library"}
                >
                    {isSaved ? <Check size={18} /> : <Bookmark size={18} />}
                    <span className="text-xs font-bold hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
                </button>
            )}

            <button 
                onClick={onClearFile}
                disabled={isParsing}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-full transition-colors disabled:opacity-50"
                title="Remove file"
            >
                <X size={20} />
            </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        w-full p-8 border-2 border-dashed rounded-xl cursor-pointer
        transition-all duration-200 group
        ${isParsing 
            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 opacity-50 cursor-not-allowed' 
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10'}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        className="hidden"
        accept=".pdf,.docx,.txt"
        disabled={isParsing}
      />
      <div className="flex flex-col items-center justify-center text-center gap-3">
        <div className="p-4 bg-indigo-50 dark:bg-slate-700/50 rounded-full text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-200">
          <UploadCloud size={32} />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Click to upload or drag and drop</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">PDF, DOCX, or TXT (max 50MB)</p>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;