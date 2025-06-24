import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../contexts/AuthContext';
import type { DrawingStroke, DrawingPoint } from '../../../../shared/types';

interface ContainerDrawingProps {
  boardId: string;
  containerId: string;
  width: number;
  height: number;
  className?: string;
}

interface DrawingState {
  isDrawing: boolean;
  currentStroke: DrawingStroke | null;
  strokes: DrawingStroke[];
  otherUserStrokes: { [userId: string]: DrawingStroke[] };
}

const ContainerDrawing: React.FC<ContainerDrawingProps> = ({ 
  boardId, 
  containerId,
  width, 
  height, 
  className = '' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { socket, isConnected } = useSocket(boardId);
  const { user } = useAuth();
  
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    currentStroke: null,
    strokes: [],
    otherUserStrokes: {}
  });

  const [drawingSettings, setDrawingSettings] = useState({
    color: '#000000',
    brushSize: 2,
    opacity: 1
  });

  // Generate unique stroke ID
  const generateStrokeId = () => `container-stroke-${containerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get canvas context
  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    return { canvas, ctx };
  }, []);

  // Clear canvas and redraw all strokes
  const redrawCanvas = useCallback(() => {
    const context = getCanvasContext();
    if (!context) return;
    
    const { canvas, ctx } = context;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all local strokes
    drawingState.strokes.forEach(stroke => {
      drawStroke(ctx, stroke);
    });
    
    // Draw other users' strokes
    Object.values(drawingState.otherUserStrokes).flat().forEach(stroke => {
      drawStroke(ctx, stroke);
    });
    
    // Draw current stroke if drawing
    if (drawingState.currentStroke) {
      drawStroke(ctx, drawingState.currentStroke);
    }
  }, [drawingState, getCanvasContext]);

  // Draw a single stroke
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (stroke.points.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.opacity;
    
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    
    ctx.stroke();
    ctx.restore();
  }, []);

  // Handle mouse down - start drawing
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!user || !isConnected) return;
    
    const context = getCanvasContext();
    if (!context) return;
    
    const { canvas, ctx } = context;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newStroke: DrawingStroke = {
      id: generateStrokeId(),
      boardId,
      userId: user.uid,
      points: [{ x, y, timestamp: Date.now() }],
      color: drawingSettings.color,
      brushSize: drawingSettings.brushSize,
      opacity: drawingSettings.opacity,
      createdAt: Date.now()
    };
    
    setDrawingState(prev => ({
      ...prev,
      isDrawing: true,
      currentStroke: newStroke
    }));
    
    // Emit container drawing status
    socket?.emit('containerDrawingStatus', { boardId, containerId, isDrawing: true });
    
    // Emit stroke start
    socket?.emit('containerStrokeStart', { 
      boardId, 
      containerId,
      strokeId: newStroke.id,
      color: drawingSettings.color,
      brushSize: drawingSettings.brushSize,
      opacity: drawingSettings.opacity
    });
  }, [user, isConnected, getCanvasContext, boardId, containerId, drawingSettings, socket]);

  // Handle mouse move - continue drawing
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.isDrawing || !drawingState.currentStroke) return;
    
    const context = getCanvasContext();
    if (!context) return;
    
    const { canvas } = context;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newPoint: DrawingPoint = { x, y, timestamp: Date.now() };
    
    const updatedStroke = {
      ...drawingState.currentStroke,
      points: [...drawingState.currentStroke.points, newPoint]
    };
    
    setDrawingState(prev => ({
      ...prev,
      currentStroke: updatedStroke
    }));
    
    // Emit point
    socket?.emit('containerStrokePoint', { 
      boardId, 
      containerId,
      strokeId: updatedStroke.id,
      point: newPoint
    });
    
    // Redraw canvas
    redrawCanvas();
  }, [drawingState.isDrawing, drawingState.currentStroke, getCanvasContext, boardId, containerId, socket, redrawCanvas]);

  // Handle mouse up - finish drawing
  const handleMouseUp = useCallback(() => {
    if (!drawingState.isDrawing || !drawingState.currentStroke) return;
    
    // Add current stroke to strokes array
    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      currentStroke: null,
      strokes: [...prev.strokes, prev.currentStroke!]
    }));
    
    // Emit drawing status
    socket?.emit('containerDrawingStatus', { boardId, containerId, isDrawing: false });
    
    // Emit stroke end
    socket?.emit('containerStrokeEnd', { 
      boardId, 
      containerId,
      strokeId: drawingState.currentStroke.id
    });
  }, [drawingState.isDrawing, drawingState.currentStroke, boardId, containerId, socket]);

  // Handle mouse leave - stop drawing
  const handleMouseLeave = useCallback(() => {
    if (drawingState.isDrawing) {
      handleMouseUp();
    }
  }, [drawingState.isDrawing, handleMouseUp]);

  // Socket event handlers for container drawing
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleContainerStrokeStart = (data: {
      boardId: string;
      containerId: string;
      strokeId: string;
      userId: string;
      color: string;
      brushSize: number;
      opacity: number;
    }) => {
      if (data.boardId !== boardId || data.containerId !== containerId || data.userId === user?.uid) return;
      
      const newStroke: DrawingStroke = {
        id: data.strokeId,
        boardId: data.boardId,
        userId: data.userId,
        points: [],
        color: data.color,
        brushSize: data.brushSize,
        opacity: data.opacity,
        createdAt: Date.now()
      };
      
      setDrawingState(prev => ({
        ...prev,
        otherUserStrokes: {
          ...prev.otherUserStrokes,
          [data.userId]: [...(prev.otherUserStrokes[data.userId] || []), newStroke]
        }
      }));
    };

    const handleContainerStrokePoint = (data: {
      boardId: string;
      containerId: string;
      strokeId: string;
      userId: string;
      point: DrawingPoint;
    }) => {
      if (data.boardId !== boardId || data.containerId !== containerId || data.userId === user?.uid) return;
      
      setDrawingState(prev => ({
        ...prev,
        otherUserStrokes: {
          ...prev.otherUserStrokes,
          [data.userId]: prev.otherUserStrokes[data.userId]?.map(stroke => 
            stroke.id === data.strokeId 
              ? { ...stroke, points: [...stroke.points, data.point] }
              : stroke
          ) || []
        }
      }));
      
      // Redraw canvas to show the new point
      setTimeout(redrawCanvas, 0);
    };

    const handleContainerStrokeEnd = (data: {
      boardId: string;
      containerId: string;
      strokeId: string;
      userId: string;
    }) => {
      if (data.boardId !== boardId || data.containerId !== containerId || data.userId === user?.uid) return;
      
      // Stroke is already complete, just redraw
      setTimeout(redrawCanvas, 0);
    };

    socket.on('containerStrokeStart', handleContainerStrokeStart);
    socket.on('containerStrokePoint', handleContainerStrokePoint);
    socket.on('containerStrokeEnd', handleContainerStrokeEnd);

    return () => {
      socket.off('containerStrokeStart', handleContainerStrokeStart);
      socket.off('containerStrokePoint', handleContainerStrokePoint);
      socket.off('containerStrokeEnd', handleContainerStrokeEnd);
    };
  }, [socket, isConnected, boardId, containerId, user, redrawCanvas]);

  // Set canvas size and redraw when dimensions change
  useEffect(() => {
    const context = getCanvasContext();
    if (!context) return;
    
    const { canvas } = context;
    canvas.width = width;
    canvas.height = height;
    
    redrawCanvas();
  }, [width, height, getCanvasContext, redrawCanvas]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          cursor: 'crosshair',
          backgroundColor: 'white',
          width: '100%',
          height: '100%'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

export default ContainerDrawing; 