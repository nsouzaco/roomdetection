/**
 * Main application component for Location Detection AI
 */
import { useState } from 'react';
import { UploadZone } from './components/upload';
import { BlueprintCanvas } from './components/canvas';
import { Card, ProcessingStatus, ControlPanel } from './components/common';
import { detectRooms } from './services';
import { detectedRoomsToCanvas } from './utils';
import type { AppError, CanvasRoom, ProcessingStatus as Status, DetectionModel } from './types';
import { ProcessingStatus as StatusEnum, DetectionModel as ModelEnum } from './types';

function App() {
  const [status, setStatus] = useState<Status>(StatusEnum.IDLE);
  const [blueprintFile, setBlueprintFile] = useState<File | null>(null);
  const [blueprintUrl, setBlueprintUrl] = useState<string>('');
  const [rooms, setRooms] = useState<CanvasRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [error, setError] = useState<AppError | null>(null);
  const [detectionModel, setDetectionModel] = useState<DetectionModel>(ModelEnum.OPENCV);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setBlueprintFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setBlueprintUrl(url);
    
    // Get image dimensions
    const img = new Image();
    img.src = url;
    
    // Start processing
    setStatus(StatusEnum.PROCESSING);
    
    try {
      const response = await detectRooms({ file }, detectionModel);
      const canvasRooms = detectedRoomsToCanvas(
        response.rooms,
        img.width,
        img.height
      );
      setRooms(canvasRooms);
      setStatus(StatusEnum.SUCCESS);
    } catch (err) {
      setError(err as AppError);
      setStatus(StatusEnum.ERROR);
    }
  };

  const handleError = (err: AppError) => {
    setError(err);
    setStatus(StatusEnum.ERROR);
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
  };

  const handleRoomUpdate = (roomId: string, updates: Partial<CanvasRoom>) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === roomId ? { ...room, ...updates } : room
      )
    );
  };

  const handleAcceptAll = () => {
    console.log('Accepting all rooms:', rooms);
    // TODO: Implement export/save functionality
    alert(`Accepted ${rooms.length} rooms! Export functionality coming soon.`);
  };

  const handleReprocess = () => {
    setRooms([]);
    setSelectedRoomId(undefined);
    setBlueprintFile(null);
    setBlueprintUrl('');
    setStatus(StatusEnum.IDLE);
    setError(null);
  };

  const handleDeleteRoom = (roomId: string) => {
    setRooms((prevRooms) => prevRooms.filter((room) => room.id !== roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(undefined);
    }
  };

  const handleExport = () => {
    const exportData = {
      blueprint: blueprintFile?.name,
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name_hint,
        confidence: room.confidence,
        bounds: {
          x: room.x,
          y: room.y,
          width: room.width,
          height: room.height,
        },
      })),
      timestamp: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'room-detection-results.json';
    link.click();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">
                roomdetection
              </h1>
              <p className="text-sm text-neutral-500">
                Automatically detect room boundaries from architectural blueprints
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upload & Canvas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Zone */}
            {!blueprintFile && (
              <Card>
                <UploadZone
                  onFileSelect={handleFileSelect}
                  onError={handleError}
                  disabled={status === StatusEnum.PROCESSING}
                />
              </Card>
            )}

            {/* Processing Status */}
            {status !== StatusEnum.IDLE && status !== StatusEnum.SUCCESS && (
              <ProcessingStatus status={status} message={error?.message} />
            )}

            {/* Error Display */}
            {error && status === StatusEnum.ERROR && (
              <Card className="border-error-200 bg-error-50">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
      <div>
                    <h3 className="text-sm font-medium text-error-900">{error.message}</h3>
                    {error.details && (
                      <p className="text-sm text-error-700 mt-1">{error.details}</p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Blueprint Canvas */}
            {blueprintUrl && (
              <Card padding="none">
                <BlueprintCanvas
                  imageUrl={blueprintUrl}
                  rooms={rooms.map((room) => ({
                    ...room,
                    selected: room.id === selectedRoomId,
                  }))}
                  onRoomSelect={handleRoomSelect}
                  onRoomUpdate={handleRoomUpdate}
                  containerWidth={800}
                  containerHeight={600}
                />
              </Card>
            )}

            {/* Instructions */}
            {!blueprintFile && (
              <Card className="bg-primary-50 border-primary-200">
                <h3 className="text-sm font-medium text-primary-900 mb-2">
                  How it works
                </h3>
                <ol className="text-sm text-primary-800 space-y-2 list-decimal list-inside">
                  <li>Upload your architectural blueprint (PNG, JPG, or TIFF)</li>
                  <li>Our AI automatically detects room boundaries</li>
                  <li>Review and adjust detected rooms as needed</li>
                  <li>Export results for use in your workflow</li>
                </ol>
              </Card>
            )}
          </div>

          {/* Right Column - Control Panel */}
          <div className="lg:col-span-1">
            <Card>
              <ControlPanel
                rooms={rooms}
                selectedRoomId={selectedRoomId}
                detectionModel={detectionModel}
                onModelChange={setDetectionModel}
                onAcceptAll={handleAcceptAll}
                onReprocess={handleReprocess}
                onDeleteRoom={handleDeleteRoom}
                onExport={handleExport}
                disabled={status === StatusEnum.PROCESSING}
              />
            </Card>
          </div>
      </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-sm text-neutral-500 text-center">
            roomdetection • AI-powered room detection • OpenCV + YOLO models
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
