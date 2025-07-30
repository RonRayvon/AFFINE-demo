import '@blocksuite/affine/all';

import {
  BlockSchemaExtension,
  defineBlockSchema,
  internalPrimitives,
  TestWorkspace,
} from '@blocksuite/store';
import { SuggestionExtension } from '@blocksuite/store';
import { DocEditorBlockSpecs } from '@blocksuite/affine/all';

// Define schemas for demo blocks
const rootSchema = defineBlockSchema({
  flavour: 'affine:page',
  props: internal => ({
    title: internal.Text(),
  }),
  metadata: {
    role: 'root',
    version: 1,
  },
});

const paragraphSchema = defineBlockSchema({
  flavour: 'affine:paragraph',
  props: internal => ({
    text: internal.Text(),
    type: 'text' as const,
  }),
  metadata: {
    role: 'content',
    parent: ['affine:note'],
    version: 1,
  },
});

const noteSchema = defineBlockSchema({
  flavour: 'affine:note',
  props: internal => ({
    xywh: '[0,0,800,95]',
    background: '--affine-background-secondary-color',
    index: 'a0',
    lockedBySelf: false,
    hidden: false,
    displayMode: 'both' as const,
    edgeless: {
      style: {
        borderRadius: 8,
        borderSize: 4,
        borderStyle: 'solid',
        shadowType: '--affine-note-shadow-box',
      },
    },
  }),
  metadata: {
    role: 'hub',
    parent: ['affine:page'],
    version: 1,
  },
});

// Create a workspace with suggestion support
const workspace = new TestWorkspace({
  id: 'suggestion-demo',
  extensions: [
    BlockSchemaExtension(rootSchema),
    BlockSchemaExtension(noteSchema),
    BlockSchemaExtension(paragraphSchema),
    SuggestionExtension,
  ],
});

// Create a new document
const doc = workspace.createDoc({ id: 'demo-doc' });

// Initialize the document with some content
function initializeDocument() {
  doc.load(() => {
    const pageId = doc.addBlock('affine:page', {
      title: doc.Text('Suggestion Demo Page'),
    });
    
    const noteId = doc.addBlock('affine:note', {}, pageId);
    
    // Add some initial paragraphs
    doc.addBlock('affine:paragraph', {
      text: doc.Text('This is the first paragraph. You can create suggestions on this block.'),
    }, noteId);
    
    doc.addBlock('affine:paragraph', {
      text: doc.Text('This is the second paragraph. Try different suggestion types!'),
    }, noteId);
    
    doc.addBlock('affine:paragraph', {
      text: doc.Text('This is the third paragraph. Suggestions support undo/redo.'),
    }, noteId);
  });
}

// Get suggestion extension
const suggestionExt = doc.getExtension(SuggestionExtension);

// Track selected block
let selectedBlockId: string | null = null;
let currentSuggestionId: string | null = null;

// Initialize the editor
async function initEditor() {
  const editorContainer = document.getElementById('editor-container')!;
  
  // Create a simple block renderer
  const renderBlocks = () => {
    editorContainer.innerHTML = '';
    
    const rootBlock = doc.root;
    if (!rootBlock) return;
    
    const noteBlock = rootBlock.children[0];
    if (!noteBlock) return;
    
    noteBlock.children.forEach(block => {
      const blockEl = document.createElement('div');
      blockEl.style.padding = '10px';
      blockEl.style.margin = '5px';
      blockEl.style.border = '1px solid #e0e0e0';
      blockEl.style.borderRadius = '4px';
      blockEl.style.cursor = 'pointer';
      blockEl.dataset.blockId = block.id;
      
      // Apply suggestion state styling
      const suggestionState = block.yBlock.get('suggestionState') as any;
      if (suggestionState) {
        blockEl.dataset.suggestionState = suggestionState.type;
        blockEl.dataset.suggestionId = suggestionState.id;
      }
      
      // Highlight selected block
      if (block.id === selectedBlockId) {
        blockEl.style.border = '2px solid #0066cc';
      }
      
      // Render text content
      const text = block.yBlock.get('prop:text') as any;
      if (text) {
        blockEl.textContent = text.toString();
      }
      
      // Handle click
      blockEl.addEventListener('click', () => {
        selectedBlockId = block.id;
        
        // Show suggestion controls if block has suggestion
        if (suggestionState) {
          currentSuggestionId = suggestionState.id;
          document.getElementById('suggestion-controls')!.classList.add('active');
        } else {
          currentSuggestionId = null;
          document.getElementById('suggestion-controls')!.classList.remove('active');
        }
        
        renderBlocks();
      });
      
      editorContainer.appendChild(blockEl);
    });
    
    updateButtonStates();
  };
  
  // Subscribe to store changes
  doc.slots.blockUpdated.subscribe(() => {
    renderBlocks();
  });
  
  // Initial render
  initializeDocument();
  renderBlocks();
}

// Update button states
function updateButtonStates() {
  const undoBtn = document.getElementById('undo') as HTMLButtonElement;
  const redoBtn = document.getElementById('redo') as HTMLButtonElement;
  
  undoBtn.disabled = !doc.canUndo;
  redoBtn.disabled = !doc.canRedo;
}

// Set up event listeners
document.getElementById('create-replace')!.addEventListener('click', () => {
  if (!selectedBlockId) {
    alert('Please select a block first');
    return;
  }
  
  const suggestionId = suggestionExt.createSuggestion(
    'replace',
    [selectedBlockId],
    [{
      flavour: 'affine:paragraph',
      text: doc.Text('This is the replacement text for the selected block.'),
    }]
  );
  
  console.log('Created replace suggestion:', suggestionId);
});

document.getElementById('create-delete')!.addEventListener('click', () => {
  if (!selectedBlockId) {
    alert('Please select a block first');
    return;
  }
  
  const suggestionId = suggestionExt.createSuggestion(
    'delete',
    [selectedBlockId]
  );
  
  console.log('Created delete suggestion:', suggestionId);
});

document.getElementById('create-insert')!.addEventListener('click', () => {
  if (!selectedBlockId) {
    alert('Please select a block first');
    return;
  }
  
  const suggestionId = suggestionExt.createSuggestion(
    'insert',
    [],
    [{
      flavour: 'affine:paragraph',
      text: doc.Text('This is a new inserted paragraph.'),
    }]
  );
  
  console.log('Created insert suggestion:', suggestionId);
});

document.getElementById('apply-suggestion')!.addEventListener('click', () => {
  if (currentSuggestionId) {
    suggestionExt.applySuggestion(currentSuggestionId);
    currentSuggestionId = null;
    document.getElementById('suggestion-controls')!.classList.remove('active');
  }
});

document.getElementById('reject-suggestion')!.addEventListener('click', () => {
  if (currentSuggestionId) {
    suggestionExt.rejectSuggestion(currentSuggestionId);
    currentSuggestionId = null;
    document.getElementById('suggestion-controls')!.classList.remove('active');
  }
});

document.getElementById('undo')!.addEventListener('click', () => {
  doc.undo();
});

document.getElementById('redo')!.addEventListener('click', () => {
  doc.redo();
});

// Initialize the editor
initEditor();