/**
 * Control panel for managing detected rooms
 */
import React from 'react';
import { Button } from './Button';
import type { CanvasRoom } from '../../types';

interface ControlPanelProps {
  rooms: CanvasRoom[];
  selectedRoomId?: string;
  onAcceptAll: () => void;
  onReprocess: () => void;
  onDeleteRoom?: (roomId: string) => void;
  onExport?: () => void;
  disabled?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  rooms,
  selectedRoomId,
  onAcceptAll,
  onReprocess,
  onDeleteRoom,
  onExport,
  disabled = false,
}) => {
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const avgConfidence = rooms.length > 0
    ? rooms.reduce((sum, r) => sum + r.confidence, 0) / rooms.length
    : 0;
  
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">
            Rooms Detected
          </p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">
            {rooms.length}
          </p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">
            Avg Confidence
          </p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">
            {Math.round(avgConfidence * 100)}%
          </p>
        </div>
      </div>
      
      {/* Selected Room Info */}
      {selectedRoom && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <p className="text-sm font-medium text-primary-900 mb-2">
            Selected Room
          </p>
          <div className="space-y-1 text-sm text-primary-800">
            <p><span className="font-medium">Name:</span> {selectedRoom.name_hint || 'Unnamed'}</p>
            <p><span className="font-medium">Confidence:</span> {Math.round(selectedRoom.confidence * 100)}%</p>
            <p><span className="font-medium">Size:</span> {Math.round(selectedRoom.width)} × {Math.round(selectedRoom.height)}px</p>
          </div>
          {onDeleteRoom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteRoom(selectedRoom.id)}
              className="mt-3 text-error-600 hover:bg-error-50"
              disabled={disabled}
            >
              Delete Room
            </Button>
          )}
        </div>
      )}
      
      {/* Room List */}
      {rooms.length > 0 && (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200">
            <p className="text-xs font-medium text-neutral-700 uppercase tracking-wide">
              Detected Rooms
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`
                  px-4 py-3 border-b border-neutral-100 last:border-b-0
                  hover:bg-neutral-50 transition-colors
                  ${room.id === selectedRoomId ? 'bg-primary-50' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {room.name_hint || `Room ${room.id.slice(-4)}`}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {Math.round(room.width)} × {Math.round(room.height)}px
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`
                        inline-block px-2 py-1 rounded text-xs font-medium
                        ${room.confidence >= 0.8
                          ? 'bg-success-100 text-success-700'
                          : room.confidence >= 0.6
                          ? 'bg-warning-100 text-warning-700'
                          : 'bg-error-100 text-error-700'
                        }
                      `}
                    >
                      {Math.round(room.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="primary"
          className="w-full"
          onClick={onAcceptAll}
          disabled={disabled || rooms.length === 0}
        >
          Accept All Rooms
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={onReprocess}
            disabled={disabled}
          >
            Reprocess
          </Button>
          {onExport && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={onExport}
              disabled={disabled || rooms.length === 0}
            >
              Export
            </Button>
          )}
        </div>
      </div>
      
      {/* Tip */}
      <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
        <p className="text-xs text-neutral-600">
          <span className="font-medium">💡 Tip:</span> Click and drag rooms to adjust their position. Click a room to select it.
        </p>
      </div>
    </div>
  );
};

