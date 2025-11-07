/**
 * Processing status indicator with loading animations
 */
import React from 'react';
import { ProcessingStatus as Status } from '../../types';

interface ProcessingStatusProps {
  status: Status;
  progress?: number;
  message?: string;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  status,
  progress,
  message,
}) => {
  if (status === Status.IDLE) return null;
  
  const getStatusConfig = () => {
    switch (status) {
      case Status.UPLOADING:
        return {
          color: 'primary',
          icon: 'upload',
          defaultMessage: 'Uploading blueprint...',
        };
      case Status.PROCESSING:
        return {
          color: 'primary',
          icon: 'processing',
          defaultMessage: 'Detecting rooms...',
        };
      case Status.SUCCESS:
        return {
          color: 'success',
          icon: 'check',
          defaultMessage: 'Detection complete!',
        };
      case Status.ERROR:
        return {
          color: 'error',
          icon: 'error',
          defaultMessage: 'Processing failed',
        };
      default:
        return {
          color: 'primary',
          icon: 'processing',
          defaultMessage: 'Processing...',
        };
    }
  };
  
  const config = getStatusConfig();
  const displayMessage = message || config.defaultMessage;
  
  const colorClasses = {
    primary: 'bg-primary-50 border-primary-200 text-primary-900',
    success: 'bg-success-50 border-success-200 text-success-900',
    error: 'bg-error-50 border-error-200 text-error-900',
  };
  
  const iconColorClasses = {
    primary: 'text-primary-600',
    success: 'text-success-600',
    error: 'text-error-600',
  };
  
  return (
    <div className={`
      rounded-lg border p-4 ${colorClasses[config.color]}
      animate-slide-up
    `}>
      <div className="flex items-center space-x-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${iconColorClasses[config.color]}`}>
          {config.icon === 'processing' && (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {config.icon === 'upload' && (
            <svg className="animate-pulse h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
          {config.icon === 'check' && (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {config.icon === 'error' && (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        
        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {displayMessage}
          </p>
          {progress !== undefined && (
            <p className="text-xs opacity-75 mt-1">
              {Math.round(progress)}% complete
            </p>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      {progress !== undefined && (
        <div className="mt-3 w-full bg-white rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              config.color === 'primary' ? 'bg-primary-600' :
              config.color === 'success' ? 'bg-success-600' :
              'bg-error-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

