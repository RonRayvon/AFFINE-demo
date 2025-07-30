import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import * as Y from 'yjs';
import { nanoid } from 'nanoid';

import type { Store, YBlock } from '../../model';
import { StoreExtension } from '../store-extension';

export type SuggestionType = 'replace' | 'delete' | 'insert';
export type SuggestionStatus = 'pending' | 'applied' | 'rejected';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  targetBlockIds: string[];
  newBlocksData?: Record<string, unknown>[];
  status: SuggestionStatus;
  createdAt: number;
}

export interface BlockSuggestionState {
  id: string;
  type: 'old' | 'new';
}

export class SuggestionExtension extends StoreExtension {
  static override readonly key = 'suggestion';

  private readonly _suggestions = signal<Map<string, Suggestion>>(new Map());
  
  readonly onSuggestionUpdated = new Subject<{
    suggestionId: string;
    action: 'added' | 'applied' | 'rejected';
  }>();

  constructor(store: Store) {
    super(store);
  }

  get suggestions() {
    return this._suggestions.value;
  }

  createSuggestion(
    type: SuggestionType,
    targetBlockIds: string[],
    newBlocksData?: Record<string, unknown>[]
  ): string {
    const suggestionId = nanoid();
    const suggestion: Suggestion = {
      id: suggestionId,
      type,
      targetBlockIds,
      newBlocksData,
      status: 'pending',
      createdAt: Date.now(),
    };

    // Store suggestion in doc meta
    const suggestionsMap = this.store.doc.meta.suggestions || new Y.Map();
    if (!this.store.doc.meta.suggestions) {
      this.store.doc.meta.suggestions = suggestionsMap;
    }
    
    this.store.transact(() => {
      suggestionsMap.set(suggestionId, suggestion);

      // Mark old blocks
      targetBlockIds.forEach(blockId => {
        const block = this.store.getBlock(blockId);
        if (block) {
          block.yBlock.set('suggestionState', {
            id: suggestionId,
            type: 'old'
          });
        }
      });

      // Create new blocks for replace/insert
      if (type !== 'delete' && newBlocksData) {
        newBlocksData.forEach(blockData => {
          const newBlockId = this.store.idGenerator.next();
          const { flavour, ...props } = blockData;
          
          // Add the block first
          this.store.addBlock(
            newBlockId,
            flavour as string,
            props
          );
          
          // Then set suggestion state on the YBlock
          const newBlock = this.store.getBlock(newBlockId);
          if (newBlock) {
            newBlock.yBlock.set('suggestionState', {
              id: suggestionId,
              type: 'new'
            });
          }
        });
      }
    });

    this._suggestions.value = new Map(this._suggestions.value).set(suggestionId, suggestion);
    this.onSuggestionUpdated.next({ suggestionId, action: 'added' });
    
    return suggestionId;
  }

  applySuggestion(suggestionId: string): void {
    const suggestion = this._suggestions.value.get(suggestionId);
    if (!suggestion || suggestion.status !== 'pending') {
      return;
    }

    this.store.transact(() => {
      // Handle different suggestion types
      switch (suggestion.type) {
        case 'delete':
          suggestion.targetBlockIds.forEach(blockId => {
            this.store.deleteBlock(blockId);
          });
          break;
          
        case 'replace':
          // Delete old blocks
          suggestion.targetBlockIds.forEach(blockId => {
            this.store.deleteBlock(blockId);
          });
          // Remove suggestion state from new blocks
          this.store.blocks.value.forEach(block => {
            const suggestionState = block.yBlock.get('suggestionState') as BlockSuggestionState;
            if (suggestionState?.id === suggestionId && suggestionState.type === 'new') {
              block.yBlock.delete('suggestionState');
            }
          });
          break;
          
        case 'insert':
          // Just remove suggestion state from new blocks
          this.store.blocks.value.forEach(block => {
            const suggestionState = block.yBlock.get('suggestionState') as BlockSuggestionState;
            if (suggestionState?.id === suggestionId && suggestionState.type === 'new') {
              block.yBlock.delete('suggestionState');
            }
          });
          break;
      }

      // Update suggestion status
      suggestion.status = 'applied';
      const suggestionsMap = this.store.doc.meta.suggestions;
      if (suggestionsMap) {
        suggestionsMap.set(suggestionId, suggestion);
      }
    });

    this._suggestions.value = new Map(this._suggestions.value).set(suggestionId, suggestion);
    this.onSuggestionUpdated.next({ suggestionId, action: 'applied' });
  }

  rejectSuggestion(suggestionId: string): void {
    const suggestion = this._suggestions.value.get(suggestionId);
    if (!suggestion || suggestion.status !== 'pending') {
      return;
    }

    this.store.transact(() => {
      // Remove suggestion state from old blocks
      suggestion.targetBlockIds.forEach(blockId => {
        const block = this.store.getBlock(blockId);
        if (block) {
          const suggestionState = block.yBlock.get('suggestionState') as BlockSuggestionState;
          if (suggestionState?.id === suggestionId) {
            block.yBlock.delete('suggestionState');
          }
        }
      });

      // Delete new blocks
      if (suggestion.type !== 'delete') {
        const blocksToDelete: string[] = [];
        this.store.blocks.value.forEach(block => {
          const suggestionState = block.yBlock.get('suggestionState') as BlockSuggestionState;
          if (suggestionState?.id === suggestionId && suggestionState.type === 'new') {
            blocksToDelete.push(block.id);
          }
        });
        blocksToDelete.forEach(blockId => {
          this.store.deleteBlock(blockId);
        });
      }

      // Update suggestion status
      suggestion.status = 'rejected';
      const suggestionsMap = this.store.doc.meta.suggestions;
      if (suggestionsMap) {
        suggestionsMap.set(suggestionId, suggestion);
      }
    });

    this._suggestions.value = new Map(this._suggestions.value).set(suggestionId, suggestion);
    this.onSuggestionUpdated.next({ suggestionId, action: 'rejected' });
  }

  override loaded() {
    // Load existing suggestions from doc meta
    const suggestionsMap = this.store.doc.meta.suggestions;
    if (suggestionsMap) {
      const suggestions = new Map<string, Suggestion>();
      suggestionsMap.forEach((value: any, key: string) => {
        suggestions.set(key, value);
      });
      this._suggestions.value = suggestions;
    }
  }

  override disposed() {
    super.disposed();
    this.onSuggestionUpdated.complete();
  }
}