/**
 * Blueprint canvas with Konva.js for visualization and interaction
 */
import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group } from 'react-konva';
import { getConfidenceColor } from '../../utils';
import type { CanvasRoom } from '../../types';

interface BlueprintCanvasProps {
  imageUrl: string;
  rooms: CanvasRoom[];
  onRoomSelect?: (roomId: string) => void;
  onRoomUpdate?: (roomId: string, updates: Partial<CanvasRoom>) => void;
  containerWidth?: number;
  containerHeight?: number;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  imageUrl,
  rooms,
  onRoomSelect,
  onRoomUpdate,
  containerWidth = 800,
  containerHeight = 600,
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [dimensions, setDimensions] = useState({ width: containerWidth, height: containerHeight });
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // Load blueprint image
  useEffect(() => {
    const img = new window.Image();
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      
      // Calculate scale to fit container
      const scaleX = containerWidth / img.width;
      const scaleY = containerHeight / img.height;
      const fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up
      
      setScale(fitScale);
      setDimensions({
        width: img.width * fitScale,
        height: img.height * fitScale,
      });
    };
    imageRef.current = img;
  }, [imageUrl, containerWidth, containerHeight]);
  
  const handleRoomDragEnd = (roomId: string, e: any) => {
    if (onRoomUpdate) {
      onRoomUpdate(roomId, {
        x: e.target.x(),
        y: e.target.y(),
      });
    }
  };
  
  const handleRoomClick = (roomId: string) => {
    if (onRoomSelect) {
      onRoomSelect(roomId);
    }
  };
  
  return (
    <div className="relative bg-neutral-100 rounded-lg overflow-hidden border border-neutral-200">
      <Stage width={dimensions.width} height={dimensions.height}>
        <Layer>
          {/* Blueprint Image */}
          {image && (
            <KonvaImage
              image={image}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
          
          {/* Room Overlays */}
          {rooms.map((room) => (
            <Group key={room.id}>
              {/* Room Rectangle */}
              <Rect
                x={room.x * scale}
                y={room.y * scale}
                width={room.width * scale}
                height={room.height * scale}
                stroke={getConfidenceColor(room.confidence)}
                strokeWidth={room.selected ? 3 : 2}
                fill={getConfidenceColor(room.confidence)}
                opacity={room.selected ? 0.3 : 0.15}
                draggable
                onDragEnd={(e) => handleRoomDragEnd(room.id, e)}
                onClick={() => handleRoomClick(room.id)}
                onTap={() => handleRoomClick(room.id)}
                shadowColor="black"
                shadowBlur={room.selected ? 10 : 0}
                shadowOpacity={0.3}
                cornerRadius={4}
              />
              
              {/* Room Label */}
              <Text
                x={room.x * scale + 8}
                y={room.y * scale + 8}
                text={`${room.name_hint || 'Room'} (${Math.round(room.confidence * 100)}%)`}
                fontSize={12}
                fontFamily="Inter, sans-serif"
                fill="#ffffff"
                padding={4}
                cornerRadius={4}
              />
              
              {/* Confidence Badge */}
              <Rect
                x={room.x * scale + 8}
                y={room.y * scale + 8}
                width={room.name_hint ? room.name_hint.length * 7 + 50 : 100}
                height={20}
                fill={getConfidenceColor(room.confidence)}
                cornerRadius={4}
                opacity={0.9}
              />
              <Text
                x={room.x * scale + 12}
                y={room.y * scale + 11}
                text={`${room.name_hint || 'Room'} ${Math.round(room.confidence * 100)}%`}
                fontSize={11}
                fontFamily="Inter, sans-serif"
                fontStyle="500"
                fill="#ffffff"
              />
            </Group>
          ))}
        </Layer>
      </Stage>
      
      {/* Legend */}
      {rooms.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-medium p-3 space-y-2">
          <p className="text-xs font-medium text-neutral-700 mb-2">Confidence</p>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-success-500"></div>
            <span className="text-neutral-600">High (≥80%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-warning-500"></div>
            <span className="text-neutral-600">Medium (60-79%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-error-500"></div>
            <span className="text-neutral-600">Low (&lt;60%)</span>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!image && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-neutral-400 text-sm">Loading blueprint...</p>
        </div>
      )}
      
      {/* Room Count Badge */}
      {rooms.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-medium px-3 py-2">
          <p className="text-sm font-medium text-neutral-900">
            {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} detected
          </p>
        </div>
      )}
    </div>
  );
};

