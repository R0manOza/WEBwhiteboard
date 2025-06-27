import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
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

// Utility functions for color conversion
function hsvToRgb(h: number, s: number, v: number) {
  let f = (n: number, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex: string) {
  let m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0,0,0];
}
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  let d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s, v];
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
  
  const [isEraserMode, setIsEraserMode] = useState(false);

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

  // Pan and zoom state
  const [viewport, setViewport] = useState({
    offsetX: 0, // pan x
    offsetY: 0, // pan y
    scale: 1    // zoom
  });
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const spacePressedRef = useRef(false);

  // Add pan mode toggle for button
  const [panMode, setPanMode] = useState(false);

  // Pan mode effect (button toggles spacePressedRef)
  useEffect(() => {
    spacePressedRef.current = panMode;
  }, [panMode]);

  // Convert screen (canvas) coords to world coords
  const screenToWorld = (x: number, y: number) => {
    return {
      x: (x - viewport.offsetX) / viewport.scale,
      y: (y - viewport.offsetY) / viewport.scale
    };
  };
  // // Convert world coords to screen (canvas) coords
  // const worldToScreen = (x: number, y: number) => {
  //   return {
  //     x: x * viewport.scale + viewport.offsetX,
  //     y: y * viewport.scale + viewport.offsetY
  //   };
  // };

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
    const context = getCanvasContext();
    if (!context) return;
    const { canvas, ctx } = context;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offsetX, viewport.offsetY);
    drawingState.strokes.forEach(stroke => {
      drawStroke(ctx, stroke);
    });
    Object.values(drawingState.otherUserStrokes).flat().forEach(stroke => {
      drawStroke(ctx, stroke);
    });
    if (drawingState.currentStroke) {
      drawStroke(ctx, drawingState.currentStroke);
    }
    ctx.restore();
  }, [drawingState, getCanvasContext, viewport]);

  // Draw a single stroke
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (stroke.points.length < 2) {
      return;
    }
    ctx.save();
    if (stroke.color === 'ERASER') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }
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
    const { canvas } = context;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const world = screenToWorld(x, y);
    const newStroke: DrawingStroke = {
      id: generateStrokeId(),
      boardId,
      userId: user.uid,
      points: [{ x: world.x, y: world.y, timestamp: Date.now() }],
      color: isEraserMode ? 'ERASER' : drawingSettings.color,
      brushSize: drawingSettings.brushSize,
      opacity: drawingSettings.opacity,
      createdAt: Date.now()
    };
    setDrawingState(prev => ({ ...prev, isDrawing: true, currentStroke: newStroke }));
    socket?.emit('drawingStatus', { boardId, isDrawing: true });
    socket?.emit('strokeStart', { boardId, strokeId: newStroke.id, color: newStroke.color, brushSize: newStroke.brushSize, opacity: newStroke.opacity });
  }, [user, isConnected, getCanvasContext, boardId, drawingSettings, socket, screenToWorld, isEraserMode]);

  // Handle mouse move - continue drawing
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.isDrawing || !drawingState.currentStroke) return;
    const context = getCanvasContext();
    if (!context) return;
    const { canvas } = context;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const world = screenToWorld(x, y);
    const newPoint: DrawingPoint = { x: world.x, y: world.y, timestamp: Date.now() };
    const updatedStroke = { ...drawingState.currentStroke, points: [...drawingState.currentStroke.points, newPoint] };
    setDrawingState(prev => ({ ...prev, currentStroke: updatedStroke }));
    socket?.emit('strokePoint', { boardId, strokeId: updatedStroke.id, point: newPoint });
    redrawCanvas();
  }, [drawingState.isDrawing, drawingState.currentStroke, getCanvasContext, boardId, socket, redrawCanvas, screenToWorld]);

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
  const handleUndo = useCallback(() => {
    setDrawingState(prev => {
      if (prev.strokes.length === 0) return prev;
      const newStrokes = prev.strokes.slice(0, -1);
      return { ...prev, strokes: newStrokes };
    });
    // Redraw will be triggered by state update effect
  }, []);

  // Zoom in/out handlers for buttons
  const zoomBy = (factor: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldPos = screenToWorld(centerX, centerY);
    let newScale = viewport.scale * factor;
    newScale = Math.max(0.1, Math.min(10, newScale));
    const newOffsetX = centerX - worldPos.x * newScale;
    const newOffsetY = centerY - worldPos.y * newScale;
    setViewport(v => ({ ...v, scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY }));
  };

  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorButtonRef = useRef<HTMLDivElement>(null);

  // HSV state for color picker
  const [hue, setHue] = useState(0); // 0-360
  const [sat, setSat] = useState(1); // 0-1
  const [val, setVal] = useState(1); // 0-1

  // Sync HSV with current color when opening
  useEffect(() => {
    if (colorPickerOpen) {
      const [r, g, b] = hexToRgb(drawingSettings.color);
      const [h, s, v] = rgbToHsv(r, g, b);
      setHue(h);
      setSat(s);
      setVal(v);
    }
  }, [colorPickerOpen]);

  const spectrumSize = 180;
  const hueBarWidth = 180;
  const hueBarHeight = 16;

  // Draw spectrum (sat/val) box
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  function drawSpectrum(hue: number) {
    if (!spectrumRef.current) return;
    const ctx = spectrumRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, spectrumSize, spectrumSize);
    for (let y = 0; y < spectrumSize; y++) {
      for (let x = 0; x < spectrumSize; x++) {
        const s = x / (spectrumSize - 1);
        const v = 1 - y / (spectrumSize - 1);
        const [r, g, b] = hsvToRgb(hue, s, v);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  useLayoutEffect(() => {
    drawSpectrum(hue);
  }, [hue, colorPickerOpen, spectrumSize, sat, val]);

  // Draw hue bar
  const hueBarRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!hueBarRef.current) return;
    const ctx = hueBarRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, hueBarWidth, hueBarHeight);
    for (let x = 0; x < hueBarWidth; x++) {
      const h = (x / (hueBarWidth - 1)) * 360;
      const [r, g, b] = hsvToRgb(h, 1, 1);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, 0, 1, hueBarHeight);
    }
  }, [colorPickerOpen, hueBarWidth, hueBarHeight, hue, sat, val]);

  // Handle spectrum drag
  const handleSpectrumPointer = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
    const rect = spectrumRef.current!.getBoundingClientRect();
    let x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    let y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const s = Math.max(0, Math.min(1, x / (rect.width - 1)));
    const v = Math.max(0, Math.min(1, 1 - y / (rect.height - 1)));
    setSat(s);
    setVal(v);
    setDrawingSettings(prev => {
      const [r, g, b] = hsvToRgb(hue, s, v);
      return { ...prev, color: rgbToHex(r, g, b) };
    });
    drawSpectrum(hue); // Always redraw after pointer interaction
  };
  // Handle hue drag
  const handleHuePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = hueBarRef.current!.getBoundingClientRect();
    let x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const h = (x / (rect.width - 1)) * 360;
    setHue(h);
    const [r, g, b] = hsvToRgb(h, sat, val);
    setDrawingSettings(prev => ({ ...prev, color: rgbToHex(r, g, b) }));
  };

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
      <div
        ref={colorButtonRef}
        className="color-box"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: drawingSettings.color,
          border: '2px solid #e5e7eb',
          marginRight: 8,
          cursor: 'pointer',
          boxShadow: colorPickerOpen ? '0 0 0 2px #2563eb' : undefined,
          position: 'relative',
          display: 'inline-block',
        }}
        onClick={() => setColorPickerOpen((v) => !v)}
        title="Choose color"
      />
      {colorPickerOpen && !isEraserMode && (
        <div
          style={{
            position: 'absolute',
            zIndex: 2000,
            top: 46,
            left: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            background: 'white',
            borderRadius: 8,
            padding: 12,
            minWidth: 200
          }}
          tabIndex={-1}
        >
          {/* Color preview swatch */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: drawingSettings.color,
            border: '2px solid #2563eb',
            margin: '0 auto 12px auto',
            boxShadow: '0 2px 8px #0002'
          }} />
          <div style={{ marginBottom: 12, position: 'relative', width: spectrumSize, height: spectrumSize }}>
            {/* Canvas first, then handle */}
            <canvas
              ref={spectrumRef}
              width={spectrumSize}
              height={spectrumSize}
              style={{ borderRadius: 8, cursor: 'crosshair', width: spectrumSize, height: spectrumSize, display: 'block', border: '2px solid #eee' }}
              onPointerDown={e => {
                handleSpectrumPointer(e);
                const move = (ev: PointerEvent) => handleSpectrumPointer({ ...e, clientX: ev.clientX, clientY: ev.clientY } as any);
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
            />
            {/* Draggable circle */}
            <div
              style={{
                position: 'absolute',
                left: `${sat * (spectrumSize - 1) - 10}px`,
                top: `${(1 - val) * (spectrumSize - 1) - 10}px`,
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '3px solid #fff',
                boxShadow: '0 0 0 2px #2563eb, 0 2px 8px #0003',
                background: drawingSettings.color,
                pointerEvents: 'none',
              }}
            />
          </div>
          <div style={{ marginBottom: 8, position: 'relative', width: hueBarWidth, height: hueBarHeight }}>
            <canvas
              ref={hueBarRef}
              width={hueBarWidth}
              height={hueBarHeight}
              style={{ borderRadius: 4, cursor: 'pointer', width: hueBarWidth, height: hueBarHeight, border: '2px solid #eee', display: 'block' }}
              onPointerDown={e => {
                handleHuePointer(e);
                const move = (ev: PointerEvent) => handleHuePointer({ ...e, clientX: ev.clientX } as any);
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
            />
            {/* Draggable hue handle */}
            <div
              style={{
                position: 'absolute',
                left: `${(hue / 360) * (hueBarWidth - 1) - 8}px`,
                top: '-4px',
                width: 16,
                height: 24,
                borderRadius: 8,
                border: '3px solid #fff',
                boxShadow: '0 0 0 2px #2563eb, 0 2px 8px #0003',
                background: `hsl(${hue},100%,50%)`,
                pointerEvents: 'none',
              }}
            />
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, color: '#333' }}>{drawingSettings.color}</div>
        </div>
      )}
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
        onClick={() => setIsEraserMode(em => !em)}
        style={{
          padding: '4px 8px',
          backgroundColor: isEraserMode ? '#2563eb' : '#e5e7eb',
          color: isEraserMode ? 'white' : '#222',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer',
          fontWeight: 600
        }}
        title={isEraserMode ? 'Switch to Pen' : 'Switch to Eraser'}
      >
        <span role="img" aria-label="eraser">🧽</span> {isEraserMode ? 'Eraser (On)' : 'Eraser'}
      </button>
      <button
        onClick={handleUndo}
        style={{
          padding: '4px 8px',
          backgroundColor: '#f59e42',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
        disabled={drawingState.strokes.length === 0}
      >
        Undo
      </button>
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
      {/* Pan/Zoom Buttons */}
      <button
        onClick={() => setPanMode(pm => !pm)}
        style={{
          padding: '4px 8px',
          backgroundColor: panMode ? '#2563eb' : '#e5e7eb',
          color: panMode ? 'white' : '#222',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer',
          fontWeight: 600
        }}
        title="Toggle Drag Mode (Pan)"
      >
        <span role="img" aria-label="drag">✋</span> Drag
      </button>
      <button
        onClick={() => zoomBy(1.1)}
        style={{
          padding: '4px 8px',
          backgroundColor: '#e5e7eb',
          color: '#222',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer',
          fontWeight: 600
        }}
        title="Zoom In"
      >
        <span role="img" aria-label="zoom-in">➕</span>
      </button>
      <button
        onClick={() => zoomBy(0.9)}
        style={{
          padding: '4px 8px',
          backgroundColor: '#e5e7eb',
          color: '#222',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer',
          fontWeight: 600
        }}
        title="Zoom Out"
      >
        <span role="img" aria-label="zoom-out">➖</span>
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

  // Redraw canvas when strokes change (including undo)
  useEffect(() => {
    redrawCanvas();
  }, [drawingState.strokes, drawingState.otherUserStrokes, drawingState.currentStroke, redrawCanvas]);

  // Keyboard shortcut for Undo (Ctrl+Z or Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isUndo = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'z';
      if (isUndo) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo]);

  // Pan/zoom handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldPos = screenToWorld(mouseX, mouseY);
      let newScale = viewport.scale * (e.deltaY < 0 ? 1.1 : 0.9);
      newScale = Math.max(0.1, Math.min(10, newScale));
      // Keep mouse position stable
      const newOffsetX = mouseX - worldPos.x * newScale;
      const newOffsetY = mouseY - worldPos.y * newScale;
      setViewport(v => ({ ...v, scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY }));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [viewport.scale, viewport.offsetX, viewport.offsetY, screenToWorld]);

  // Pan logic
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2 || spacePressedRef.current) {
      isPanningRef.current = true;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    handleMouseDown(e);
  };
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPosRef.current.x;
      const dy = e.clientY - lastPanPosRef.current.y;
      setViewport(v => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    handleMouseMove(e);
  };
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      console.log(e);
      isPanningRef.current = false;
      return;
    }
    handleMouseUp();
  };

  return (
    <div style={{ position: 'relative', width, height }}>
      <DrawingTools />
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          cursor: isPanningRef.current ? 'grab' : 'crosshair',
          backgroundColor: 'white',
          width: '100%',
          height: '100%'
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleMouseLeave}
        tabIndex={0}
      />
    </div>
  );
};

export default DrawingCanvas; 