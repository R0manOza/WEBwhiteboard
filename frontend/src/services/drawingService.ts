import { db } from '../firebase/config';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import type { BoardDrawing, DrawingStroke } from '../../../shared/types';

const DRAWINGS_COLLECTION = 'boardDrawings';

export class DrawingService {
  /**
   * Save a complete drawing state for a board
   */
  static async saveBoardDrawing(boardId: string, strokes: DrawingStroke[]): Promise<void> {
    try {
      const drawingRef = doc(db, DRAWINGS_COLLECTION, boardId);
      const drawingData: BoardDrawing = {
        boardId,
        strokes,
        lastUpdated: Date.now()
      };
      
      await setDoc(drawingRef, drawingData);
      console.log(`Drawing saved for board ${boardId} with ${strokes.length} strokes`);
    } catch (error) {
      console.error('Error saving drawing:', error);
      throw error;
    }
  }

  /**
   * Load a board's drawing data
   */
  static async loadBoardDrawing(boardId: string): Promise<BoardDrawing | null> {
    try {
      const drawingRef = doc(db, DRAWINGS_COLLECTION, boardId);
      const drawingDoc = await getDoc(drawingRef);
      
      if (drawingDoc.exists()) {
        const data = drawingDoc.data() as BoardDrawing;
        console.log(`Drawing loaded for board ${boardId} with ${data.strokes.length} strokes`);
        return data;
      } else {
        console.log(`No drawing data found for board ${boardId}`);
        return null;
      }
    } catch (error) {
      console.error('Error loading drawing:', error);
      throw error;
    }
  }

  /**
   * Add a single stroke to a board's drawing
   */
  static async addStroke(boardId: string, stroke: DrawingStroke): Promise<void> {
    try {
      const drawingRef = doc(db, DRAWINGS_COLLECTION, boardId);
      
      // Get current drawing data
      const drawingDoc = await getDoc(drawingRef);
      let currentStrokes: DrawingStroke[] = [];
      
      if (drawingDoc.exists()) {
        const data = drawingDoc.data() as BoardDrawing;
        currentStrokes = data.strokes;
      }
      
      // Add new stroke
      const updatedStrokes = [...currentStrokes, stroke];
      
      // Save updated drawing
      const updatedDrawing: BoardDrawing = {
        boardId,
        strokes: updatedStrokes,
        lastUpdated: Date.now()
      };
      
      await setDoc(drawingRef, updatedDrawing);
      console.log(`Stroke added to board ${boardId}, total strokes: ${updatedStrokes.length}`);
    } catch (error) {
      console.error('Error adding stroke:', error);
      throw error;
    }
  }

  /**
   * Clear all drawings for a board
   */
  static async clearBoardDrawing(boardId: string): Promise<void> {
    try {
      const drawingRef = doc(db, DRAWINGS_COLLECTION, boardId);
      const clearedDrawing: BoardDrawing = {
        boardId,
        strokes: [],
        lastUpdated: Date.now()
      };
      
      await setDoc(drawingRef, clearedDrawing);
      console.log(`Drawing cleared for board ${boardId}`);
    } catch (error) {
      console.error('Error clearing drawing:', error);
      throw error;
    }
  }

  /**
   * Listen to real-time updates for a board's drawing
   */
  static subscribeToBoardDrawing(
    boardId: string, 
    callback: (drawing: BoardDrawing | null) => void
  ): () => void {
    const drawingRef = doc(db, DRAWINGS_COLLECTION, boardId);
    
    const unsubscribe = onSnapshot(drawingRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as BoardDrawing;
        callback(data);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error listening to drawing updates:', error);
      callback(null);
    });

    return unsubscribe;
  }
} 