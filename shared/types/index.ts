/**
 * Represents a collaborative board where users can organize containers and content
 * @interface Board
 */
export interface Board {
  id: string;
  name: string;
  description?: string;
  visibility: "public" | "private";
  passwordHash?: string;
  ownerId: string;
  members: { [userId: string]: "owner" | "member" };
  createdAt: number;
  updatedAt: number;
}
/**
 * Represents a container within a board that holds either links or notes
 * @interface Container
 */
export interface Container {
  id: string;
  boardId: string;
  title: string;
  purpose: "links" | "notes";
  position: { x: number; y: number };
  size: { width: number; height: number };
  style?: { backgroundColor?: string; borderStyle?: string };
  createdAt: number;
  updatedAt: number;
}
/**
 * Represents a link item stored within a links container
 * @interface LinkItem
 */
export interface LinkItem {
  id: string;
  containerId: string;
  url: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}
/**
 * Represents a note item stored within a notes container
 * @interface NoteItem
 */
export interface NoteItem {
  id: string;
  containerId: string;
  title: string;
  content: string;
  color?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}