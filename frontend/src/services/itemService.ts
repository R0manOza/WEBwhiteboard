import { auth } from '../firebase/config';
import type { NoteItem, LinkItem } from '../../../shared/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ItemService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Get all items for a container
  async getItems(boardId: string, containerId: string): Promise<(NoteItem | LinkItem)[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/containers/${containerId}/items`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.statusText}`);
      }

      const items = await response.json();
      console.log(`[ItemService] Loaded ${items.length} items for container ${containerId}`);
      return items;
    } catch (error) {
      console.error('[ItemService] Error fetching items:', error);
      throw error;
    }
  }

  // Create a new note item
  async createNote(boardId: string, containerId: string, title: string, content: string, color?: string): Promise<NoteItem> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/containers/${containerId}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'note',
          title,
          content,
          color: color || '#fef3c7'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create note: ${response.statusText}`);
      }

      const note = await response.json();
      console.log(`[ItemService] Created note: ${note.id}`);
      return note;
    } catch (error) {
      console.error('[ItemService] Error creating note:', error);
      throw error;
    }
  }

  // Create a new link item
  async createLink(boardId: string, containerId: string, title: string, url: string, description?: string): Promise<LinkItem> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/containers/${containerId}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'link',
          title,
          url,
          description: description || ''
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create link: ${response.statusText}`);
      }

      const link = await response.json();
      console.log(`[ItemService] Created link: ${link.id}`);
      return link;
    } catch (error) {
      console.error('[ItemService] Error creating link:', error);
      throw error;
    }
  }

  // Update an item
  async updateItem(boardId: string, containerId: string, itemId: string, updates: Partial<NoteItem | LinkItem>): Promise<NoteItem | LinkItem> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/containers/${containerId}/items/${itemId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update item: ${response.statusText}`);
      }

      const updatedItem = await response.json();
      console.log(`[ItemService] Updated item: ${itemId}`);
      return updatedItem;
    } catch (error) {
      console.error('[ItemService] Error updating item:', error);
      throw error;
    }
  }

  // Delete an item
  async deleteItem(boardId: string, containerId: string, itemId: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/containers/${containerId}/items/${itemId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to delete item: ${response.statusText}`);
      }

      console.log(`[ItemService] Deleted item: ${itemId}`);
    } catch (error) {
      console.error('[ItemService] Error deleting item:', error);
      throw error;
    }
  }
}

export const itemService = new ItemService();
export default itemService; 