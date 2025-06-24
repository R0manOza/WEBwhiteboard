import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../contexts/AuthContext';
import type { DrawingStroke, DrawingPoint } from '../../../../shared/types';

interface DrawingCanvasProps {
  boardId: string;
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

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ 
  boardId, 
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
    brushSize: 3,
    opacity: 1
  });

  // Generate unique stroke ID
  const generateStrokeId = () => `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    console.log('DrawingCanvas: Redrawing canvas');
    const context = getCanvasContext();
    if (!context) {
      console.log('DrawingCanvas: No context for redraw');
      return;
    }
    
    const { canvas, ctx } = context;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('DrawingCanvas: Canvas cleared, drawing strokes');
    
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
      console.log('DrawingCanvas: Drawing current stroke with', drawingState.currentStroke.points.length, 'points');
      drawStroke(ctx, drawingState.currentStroke);
    }
  }, [drawingState, getCanvasContext]);

  // Draw a single stroke
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (stroke.points.length < 2) {
      console.log('DrawingCanvas: Stroke has less than 2 points, skipping');
      return;
    }
    
    console.log('DrawingCanvas: Drawing stroke with', stroke.points.length, 'points, color:', stroke.color, 'brushSize:', stroke.brushSize);
    
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
    console.log('DrawingCanvas: Stroke drawn successfully');
  }, []);

  // Handle mouse down - start drawing
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('DrawingCanvas: Mouse down event triggered', { x: e.clientX, y: e.clientY });
    if (!user || !isConnected) {
      console.log('DrawingCanvas: Skipping - no user or not connected', { user: !!user, isConnected });
      return;
    }
    
    const context = getCanvasContext();
    if (!context) {
      console.log('DrawingCanvas: No canvas context available');
      return;
    }
    
    const { canvas, ctx } = context;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    console.log('DrawingCanvas: Starting new stroke', { x, y, color: drawingSettings.color, brushSize: drawingSettings.brushSize });
    
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
    
    // Emit drawing status
    socket?.emit('drawingStatus', { boardId, isDrawing: true });
    
    // Emit stroke start
    socket?.emit('strokeStart', { 
      boardId, 
      strokeId: newStroke.id,
      color: drawingSettings.color,
      brushSize: drawingSettings.brushSize,
      opacity: drawingSettings.opacity
    });
  }, [user, isConnected, getCanvasContext, boardId, drawingSettings, socket]);

  // Handle mouse move - continue drawing
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.isDrawing || !drawingState.currentStroke) {
      return;
    }
    
    console.log('DrawingCanvas: Mouse move event triggered', { x: e.clientX, y: e.clientY });
    
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
    socket?.emit('strokePoint', { 
      boardId, 
      strokeId: updatedStroke.id,
      point: newPoint
    });
    
    // Redraw canvas
    redrawCanvas();
  }, [drawingState.isDrawing, drawingState.currentStroke, getCanvasContext, boardId, socket, redrawCanvas]);

  // Handle mouse up - finish drawing
  const handleMouseUp = useCallback(() => {
    if (!drawingState.isDrawing || !drawingState.currentStroke) {
      return;
    }
    
    console.log('DrawingCanvas: Mouse up event triggered - finishing stroke');
    
    // Add current stroke to strokes array
    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      currentStroke: null,
      strokes: [...prev.strokes, prev.currentStroke!]
    }));
    
    // Emit drawing status
    socket?.emit('drawingStatus', { boardId, isDrawing: false });
    
    // Emit stroke end
    socket?.emit('strokeEnd', { 
      boardId, 
      strokeId: drawingState.currentStroke.id
    });
  }, [drawingState.isDrawing, drawingState.currentStroke, boardId, socket]);

  // Handle mouse leave - stop drawing
  const handleMouseLeave = useCallback(() => {
    if (drawingState.isDrawing) {
      handleMouseUp();
    }
  }, [drawingState.isDrawing, handleMouseUp]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleStrokeStart = (data: {
      boardId: string;
      strokeId: string;
      userId: string;
      color: string;
      brushSize: number;
      opacity: number;
    }) => {
      if (data.boardId !== boardId || data.userId === user?.uid) return;
      
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

    const handleStrokePoint = (data: {
      boardId: string;
      strokeId: string;
      userId: string;
      point: DrawingPoint;
    }) => {
      if (data.boardId !== boardId || data.userId === user?.uid) return;
      
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

    const handleStrokeEnd = (data: {
      boardId: string;
      strokeId: string;
      userId: string;
    }) => {
      if (data.boardId !== boardId || data.userId === user?.uid) return;
      
      // Stroke is already complete, just redraw
      setTimeout(redrawCanvas, 0);
    };

    const handleUserDrawingStatus = (data: {
      boardId: string;
      userId: string;
      isDrawing: boolean;
    }) => {
      if (data.boardId !== boardId || data.userId === user?.uid) return;
      
      // You could add visual indicators here for when other users are drawing
      console.log(`User ${data.userId} is ${data.isDrawing ? 'drawing' : 'not drawing'}`);
    };

    socket.on('strokeStart', handleStrokeStart);
    socket.on('strokePoint', handleStrokePoint);
    socket.on('strokeEnd', handleStrokeEnd);
    socket.on('userDrawingStatus', handleUserDrawingStatus);

    return () => {
      socket.off('strokeStart', handleStrokeStart);
      socket.off('strokePoint', handleStrokePoint);
      socket.off('strokeEnd', handleStrokeEnd);
      socket.off('userDrawingStatus', handleUserDrawingStatus);
    };
  }, [socket, isConnected, boardId, user, redrawCanvas]);

  // Set canvas size and redraw when dimensions change
  useEffect(() => {
    const context = getCanvasContext();
    if (!context) return;
    
    const { canvas } = context;
    canvas.width = width;
    canvas.height = height;
    
    redrawCanvas();
  }, [width, height, getCanvasContext, redrawCanvas]);

  // Drawing tools
  const DrawingTools = () => (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: '8px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <input
        type="color"
        value={drawingSettings.color}
        onChange={(e) => setDrawingSettings(prev => ({ ...prev, color: e.target.value }))}
        style={{ width: '30px', height: '30px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      />
      <input
        type="range"
        min="1"
        max="20"
        value={drawingSettings.brushSize}
        onChange={(e) => setDrawingSettings(prev => ({ ...prev, brushSize: parseInt(e.target.value) }))}
        style={{ width: '80px' }}
      />
      <span style={{ fontSize: '12px', color: '#666' }}>
        {drawingSettings.brushSize}px
      </span>
      <button
        onClick={() => {
          setDrawingState(prev => ({ ...prev, strokes: [], otherUserStrokes: {} }));
          const context = getCanvasContext();
          if (context) {
            context.ctx.clearRect(0, 0, context.canvas.width, context.canvas.height);
          }
          // Emit clear event to all users
          socket?.emit('clearBoardDrawing', { boardId });
        }}
        style={{
          padding: '4px 8px',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        Clear
      </button>
    </div>
  );

  // Listen for clearBoardDrawing event from socket
  useEffect(() => {
    if (!socket || !isConnected) return;
    const handleClear = (data: { boardId: string }) => {
      if (data.boardId !== boardId) return;
      setDrawingState(prev => ({ ...prev, strokes: [], otherUserStrokes: {}, currentStroke: null }));
      const context = getCanvasContext();
      if (context) {
        context.ctx.clearRect(0, 0, context.canvas.width, context.canvas.height);
      }
    };
    socket.on('clearBoardDrawing', handleClear);
    return () => {
      socket.off('clearBoardDrawing', handleClear);
    };
  }, [socket, isConnected, boardId, getCanvasContext]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <DrawingTools />
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          cursor: 'crosshair',
          backgroundColor: 'white'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

export default DrawingCanvas; 