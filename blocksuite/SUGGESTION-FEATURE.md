# BlockSuite Suggestion Feature Implementation

This document describes the implementation of a Suggestion feature for the BlockSuite editor that supports `replace`, `delete`, and `insert` operations with full undo/redo support.

## Overview

The Suggestion feature allows users to propose changes to document content without immediately applying them. Each suggestion can be:
- **Applied**: The proposed changes are committed to the document
- **Rejected**: The suggestion is discarded, and the document remains unchanged
- Both operations support undo/redo through BlockSuite's built-in history management

## Architecture

### 1. Core Components

#### SuggestionExtension (`framework/store/src/extension/suggestion/suggestion-extension.ts`)
- Extends `StoreExtension` to integrate with BlockSuite's extension system
- Manages all suggestions in a document
- Provides APIs for creating, applying, and rejecting suggestions
- Stores suggestion metadata in `doc.meta.suggestions` using Yjs Map

#### Suggestion Data Model
```typescript
interface Suggestion {
  id: string;                          // Unique identifier
  type: SuggestionType;                // 'replace' | 'delete' | 'insert'
  targetBlockIds: string[];            // Blocks to be modified
  newBlocksData?: Record<string, unknown>[]; // Data for new blocks
  status: SuggestionStatus;            // 'pending' | 'applied' | 'rejected'
  createdAt: number;                   // Timestamp
}

interface BlockSuggestionState {
  id: string;                          // Suggestion ID
  type: 'old' | 'new';                // Block role in suggestion
}
```

### 2. Implementation Details

#### Block State Management
- Suggestion state is stored directly on YBlock using `yBlock.set('suggestionState', state)`
- This allows the state to be part of the CRDT data model and automatically synchronized
- Old blocks (to be replaced/deleted) are marked with `type: 'old'`
- New blocks (replacements/insertions) are marked with `type: 'new'`

#### Transaction Support
All operations are wrapped in `store.transact()` to ensure:
- Atomic execution of multi-step operations
- Proper integration with BlockSuite's UndoManager
- Consistent state across collaborative sessions

#### Visual Representation
The demo includes CSS styles for visual differentiation:
```css
[data-suggestion-state="old"] {
  background-color: #f0f0f0; /* Gray for old blocks */
}

[data-suggestion-state="new"] {
  background-color: #e0f8e0; /* Light green for new blocks */
}
```

## API Usage

### Creating Suggestions

```typescript
const suggestionExt = doc.getExtension(SuggestionExtension);

// Replace suggestion
const replaceId = suggestionExt.createSuggestion(
  'replace',
  [oldBlockId],
  [{
    flavour: 'paragraph',
    text: doc.Text('Replacement text'),
  }]
);

// Delete suggestion
const deleteId = suggestionExt.createSuggestion(
  'delete',
  [blockIdToDelete]
);

// Insert suggestion
const insertId = suggestionExt.createSuggestion(
  'insert',
  [],
  [{
    flavour: 'paragraph',
    text: doc.Text('New paragraph'),
  }]
);
```

### Applying/Rejecting Suggestions

```typescript
// Apply a suggestion
suggestionExt.applySuggestion(suggestionId);

// Reject a suggestion
suggestionExt.rejectSuggestion(suggestionId);
```

### Subscribing to Changes

```typescript
suggestionExt.onSuggestionUpdated.subscribe(({ suggestionId, action }) => {
  console.log(`Suggestion ${suggestionId} was ${action}`);
});
```

## Demo Files

1. **HTML Demo**: `playground/examples/suggestion-demo.html`
   - Interactive UI for testing suggestion functionality
   - Shows visual feedback for suggestion states
   - Includes Apply/Reject buttons

2. **TypeScript Demo**: `playground/examples/suggestion-demo.ts`
   - Sets up a basic editor with suggestion support
   - Demonstrates creating different types of suggestions
   - Handles user interactions

3. **Test Suite**: `tests/suggestion-demo.spec.ts`
   - Unit tests for all suggestion operations
   - Verifies undo/redo functionality
   - Includes a runnable demo function

## Key Design Decisions

1. **YBlock Storage**: Storing suggestion state directly on YBlock ensures it's part of the CRDT model and synchronized across clients.

2. **Extension Pattern**: Using BlockSuite's extension system provides clean integration and lifecycle management.

3. **Transaction Wrapping**: All multi-step operations are wrapped in transactions to ensure atomicity and proper undo/redo support.

4. **Separation of Concerns**: The visual representation is separated from the data model, allowing different UIs to render suggestions differently.

## Future Enhancements

1. **Permissions**: Add user-based permissions for who can create/apply suggestions
2. **Comments**: Attach comments or reasons to suggestions
3. **Bulk Operations**: Apply/reject multiple suggestions at once
4. **Conflict Resolution**: Handle conflicts when multiple suggestions target the same blocks
5. **Rich UI Components**: Create polished UI components for suggestion management

## Testing

Run the test suite to verify functionality:
```bash
# After installing dependencies
yarn test tests/suggestion-demo.spec.ts
```

Or run the demo function directly:
```bash
# Run the demo script
node --loader tsx tests/suggestion-demo.spec.ts
```