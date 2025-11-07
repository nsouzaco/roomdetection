/**
 * Drag-and-drop file upload zone for blueprints
 */
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { validateBlueprintFile } from '../../utils';
import type { AppError } from '../../types';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  onError: (error: AppError) => void;
  disabled?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileSelect,
  onError,
  disabled = false,
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const validationError = validateBlueprintFile(file);
    
    if (validationError) {
      onError(validationError);
      return;
    }
    
    onFileSelect(file);
  }, [onFileSelect, onError]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/tiff': ['.tiff', '.tif'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled,
  });
  
  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-xl p-12
        transition-all duration-200 cursor-pointer
        ${isDragActive
          ? 'border-primary-500 bg-primary-50'
          : 'border-neutral-300 bg-neutral-50 hover:border-primary-400 hover:bg-neutral-100'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        {/* Upload Icon */}
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center
          ${isDragActive ? 'bg-primary-100' : 'bg-neutral-200'}
        `}>
          <svg 
            className={`w-8 h-8 ${isDragActive ? 'text-primary-600' : 'text-neutral-600'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
        </div>
        
        {/* Text */}
        <div>
          <p className="text-lg font-medium text-neutral-900">
            {isDragActive ? 'Drop your blueprint here' : 'Drag and drop your blueprint'}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            or click to browse files
          </p>
        </div>
        
        {/* Supported formats */}
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="px-2 py-1 bg-white rounded border border-neutral-200">PNG</span>
          <span className="px-2 py-1 bg-white rounded border border-neutral-200">JPG</span>
          <span className="px-2 py-1 bg-white rounded border border-neutral-200">TIFF</span>
          <span className="text-neutral-400">• Max 10MB</span>
        </div>
      </div>
    </div>
  );
};

