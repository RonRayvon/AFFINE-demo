import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import {
  BlockSchemaExtension,
  defineBlockSchema,
  TestWorkspace,
  Store,
} from '../framework/store/src';
import { SuggestionExtension } from '../framework/store/src/extension/suggestion/suggestion-extension';

// Define test schemas
const rootSchema = defineBlockSchema({
  flavour: 'page',
  props: internal => ({
    title: internal.Text(),
  }),
  metadata: {
    role: 'root',
    version: 1,
  },
});

const paragraphSchema = defineBlockSchema({
  flavour: 'paragraph',
  props: internal => ({
    text: internal.Text(),
  }),
  metadata: {
    role: 'content',
    parent: ['page'],
    version: 1,
  },
});

describe('Suggestion Extension', () => {
  test('should create and apply a replace suggestion', () => {
    // Create workspace with suggestion support
    const workspace = new TestWorkspace({
      id: 'test-workspace',
      extensions: [
        BlockSchemaExtension(rootSchema),
        BlockSchemaExtension(paragraphSchema),
        SuggestionExtension,
      ],
    });

    // Create a document
    const doc = workspace.createDoc({ id: 'test-doc' });
    
    doc.load(() => {
      // Add initial content
      const pageId = doc.addBlock('page', {
        title: doc.Text('Test Page'),
      });
      
      const paragraphId = doc.addBlock('paragraph', {
        text: doc.Text('Original text'),
      }, pageId);
      
      // Get suggestion extension
      const suggestionExt = doc.getExtension(SuggestionExtension);
      
      // Create a replace suggestion
      const suggestionId = suggestionExt.createSuggestion(
        'replace',
        [paragraphId],
        [{
          flavour: 'paragraph',
          text: doc.Text('Replacement text'),
        }]
      );
      
      // Verify old block has suggestion state
      const oldBlock = doc.getBlock(paragraphId);
      expect(oldBlock).toBeTruthy();
      const oldSuggestionState = oldBlock!.yBlock.get('suggestionState') as any;
      expect(oldSuggestionState).toEqual({
        id: suggestionId,
        type: 'old',
      });
      
      // Verify new block was created with suggestion state
      const blocks = Array.from(doc.blocks.value.values());
      const newBlock = blocks.find(block => {
        const state = block.yBlock.get('suggestionState') as any;
        return state?.id === suggestionId && state?.type === 'new';
      });
      expect(newBlock).toBeTruthy();
      
      // Apply the suggestion
      suggestionExt.applySuggestion(suggestionId);
      
      // Verify old block was deleted
      expect(doc.getBlock(paragraphId)).toBeFalsy();
      
      // Verify new block no longer has suggestion state
      const remainingBlocks = Array.from(doc.blocks.value.values());
      const appliedBlock = remainingBlocks.find(block => 
        block.yBlock.get('prop:text')?.toString() === 'Replacement text'
      );
      expect(appliedBlock).toBeTruthy();
      expect(appliedBlock!.yBlock.get('suggestionState')).toBeFalsy();
    });
  });

  test('should create and reject a delete suggestion', () => {
    const workspace = new TestWorkspace({
      id: 'test-workspace-2',
      extensions: [
        BlockSchemaExtension(rootSchema),
        BlockSchemaExtension(paragraphSchema),
        SuggestionExtension,
      ],
    });

    const doc = workspace.createDoc({ id: 'test-doc-2' });
    
    doc.load(() => {
      const pageId = doc.addBlock('page', {
        title: doc.Text('Test Page'),
      });
      
      const paragraphId = doc.addBlock('paragraph', {
        text: doc.Text('Text to delete'),
      }, pageId);
      
      const suggestionExt = doc.getExtension(SuggestionExtension);
      
      // Create a delete suggestion
      const suggestionId = suggestionExt.createSuggestion(
        'delete',
        [paragraphId]
      );
      
      // Verify block has suggestion state
      const block = doc.getBlock(paragraphId);
      expect(block).toBeTruthy();
      const suggestionState = block!.yBlock.get('suggestionState') as any;
      expect(suggestionState).toEqual({
        id: suggestionId,
        type: 'old',
      });
      
      // Reject the suggestion
      suggestionExt.rejectSuggestion(suggestionId);
      
      // Verify block still exists and no longer has suggestion state
      const rejectedBlock = doc.getBlock(paragraphId);
      expect(rejectedBlock).toBeTruthy();
      expect(rejectedBlock!.yBlock.get('suggestionState')).toBeFalsy();
    });
  });

  test('should support undo/redo for apply operations', () => {
    const workspace = new TestWorkspace({
      id: 'test-workspace-3',
      extensions: [
        BlockSchemaExtension(rootSchema),
        BlockSchemaExtension(paragraphSchema),
        SuggestionExtension,
      ],
    });

    const doc = workspace.createDoc({ id: 'test-doc-3' });
    
    doc.load(() => {
      const pageId = doc.addBlock('page', {
        title: doc.Text('Test Page'),
      });
      
      const paragraphId = doc.addBlock('paragraph', {
        text: doc.Text('Original text'),
      }, pageId);
      
      const suggestionExt = doc.getExtension(SuggestionExtension);
      
      // Create and apply a replace suggestion
      const suggestionId = suggestionExt.createSuggestion(
        'replace',
        [paragraphId],
        [{
          flavour: 'paragraph',
          text: doc.Text('New text'),
        }]
      );
      
      suggestionExt.applySuggestion(suggestionId);
      
      // Verify replacement happened
      expect(doc.getBlock(paragraphId)).toBeFalsy();
      const newBlock = Array.from(doc.blocks.value.values()).find(block => 
        block.yBlock.get('prop:text')?.toString() === 'New text'
      );
      expect(newBlock).toBeTruthy();
      
      // Undo the apply operation
      doc.undo();
      
      // Verify original state is restored
      const restoredBlock = doc.getBlock(paragraphId);
      expect(restoredBlock).toBeTruthy();
      expect(restoredBlock!.yBlock.get('prop:text')?.toString()).toBe('Original text');
      
      // Verify suggestion state is restored
      const restoredSuggestionState = restoredBlock!.yBlock.get('suggestionState') as any;
      expect(restoredSuggestionState).toEqual({
        id: suggestionId,
        type: 'old',
      });
      
      // Redo the apply operation
      doc.redo();
      
      // Verify replacement is re-applied
      expect(doc.getBlock(paragraphId)).toBeFalsy();
      const redoneBlock = Array.from(doc.blocks.value.values()).find(block => 
        block.yBlock.get('prop:text')?.toString() === 'New text'
      );
      expect(redoneBlock).toBeTruthy();
    });
  });
});

// Demo function for manual testing
export function runSuggestionDemo() {
  console.log('Starting Suggestion Demo...');
  
  const workspace = new TestWorkspace({
    id: 'demo-workspace',
    extensions: [
      BlockSchemaExtension(rootSchema),
      BlockSchemaExtension(paragraphSchema),
      SuggestionExtension,
    ],
  });

  const doc = workspace.createDoc({ id: 'demo-doc' });
  
  doc.load(() => {
    // Create initial content
    const pageId = doc.addBlock('page', {
      title: doc.Text('Suggestion Demo'),
    });
    
    const p1 = doc.addBlock('paragraph', {
      text: doc.Text('This is the first paragraph.'),
    }, pageId);
    
    const p2 = doc.addBlock('paragraph', {
      text: doc.Text('This is the second paragraph.'),
    }, pageId);
    
    const p3 = doc.addBlock('paragraph', {
      text: doc.Text('This is the third paragraph.'),
    }, pageId);
    
    console.log('Initial blocks:', doc.blocks.value);
    
    const suggestionExt = doc.getExtension(SuggestionExtension);
    
    // Create a replace suggestion on the second paragraph
    const replaceSuggestionId = suggestionExt.createSuggestion(
      'replace',
      [p2],
      [{
        flavour: 'paragraph',
        text: doc.Text('This paragraph has been replaced!'),
      }]
    );
    
    console.log('Created replace suggestion:', replaceSuggestionId);
    console.log('Blocks after suggestion:', doc.blocks.value);
    
    // Log suggestion states
    doc.blocks.value.forEach(block => {
      const state = block.yBlock.get('suggestionState');
      if (state) {
        console.log(`Block ${block.id} has suggestion state:`, state);
      }
    });
    
    // Apply the suggestion
    console.log('Applying suggestion...');
    suggestionExt.applySuggestion(replaceSuggestionId);
    
    console.log('Blocks after apply:', doc.blocks.value);
    
    // Test undo
    console.log('Undoing...');
    doc.undo();
    console.log('Blocks after undo:', doc.blocks.value);
    
    // Test redo
    console.log('Redoing...');
    doc.redo();
    console.log('Blocks after redo:', doc.blocks.value);
  });
  
  return { workspace, doc };
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSuggestionDemo();
}