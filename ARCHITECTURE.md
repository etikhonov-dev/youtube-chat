# YouTube CLI Companion - Architecture Documentation

## Overview

This application follows a **layered architecture** pattern with clear separation of concerns. The codebase is organized into distinct layers that handle UI, business logic, services, and utilities independently.

## Project Structure

```
youtube-chat/
├── index.js                    # Entry point - orchestration only
├── localization.js             # Localization/i18n system
├── src/
│   ├── ui/                     # UI Layer
│   │   ├── console.js          # Console display & formatting
│   │   ├── prompts.js          # User prompts & interactive commands
│   │   └── chat.js             # Chat interface controller
│   ├── core/                   # Core Business Logic
│   │   ├── agent.js            # AI agent, tools, summary generation
│   │   ├── youtube.js          # YouTube data loading & metadata
│   │   └── vector-store.js     # Vector store & semantic chunking
│   ├── services/               # Shared Services
│   │   ├── config.js           # Configuration management
│   │   └── export.js           # Conversation export functionality
│   └── utils/                  # Utilities
│       └── formatting.js       # Helper functions (timestamps, IDs, etc.)
└── ARCHITECTURE.md             # This file
```

## Architecture Layers

### 1. Entry Point (`index.js`)

**Purpose**: Application orchestration and initialization flow

**Responsibilities**:
- Parse command-line arguments
- Load configuration
- Initialize core components (YouTube data, vector store, agent)
- Coordinate the main execution flow
- Handle top-level error management

**Key Functions**:
- `initialize(config)` - Coordinates system initialization
- Main IIFE - Entry point execution

**Dependencies**: Imports from all layers but contains minimal logic

---

### 2. UI Layer (`src/ui/`)

**Purpose**: All user-facing interactions and display logic

**Key Principle**: UI components should NEVER contain business logic. They receive data and display it, or collect user input and pass it to other layers.

#### `console.js`
- Display formatting (markdown rendering, video info, headers)
- Spinner management (loading, thinking animations)
- Error message display
- Summary display

**Exports**:
- `renderMarkdown(text)` - Convert markdown to terminal output
- `displayUsage(locale)` - Show usage information
- `displayVideoInfo(videoMetadata, locale)` - Show video details
- `displayChatHeader(uiLanguage, transcriptLanguage, locale)` - Show chat header
- `startSpinner(text)` - Create loading spinner
- `startThinkingSpinner(text)` - Create non-blocking thinking spinner
- `displayAssistantResponse(content, locale)` - Show AI response
- `displayError(messageKey, locale, params)` - Show error messages
- `displaySummary(content)` - Show video summary

#### `prompts.js`
- User input prompts
- Command handlers (`/export`, `/lang`)
- Interactive dialogs

**Exports**:
- `handleExportCommand(rl, conversationHistory, videoMetadata, youtubeUrl, locale)` - Handle export flow
- `handleLangCommand(rl, locale)` - Handle language selection flow

#### `chat.js`
- Main chat loop
- User input processing
- Command routing (exit, /export, /lang)
- Conversation history management

**Exports**:
- `startChat(agent, conversationHistory, videoMetadata, youtubeUrl, locale, uiLanguage, transcriptLanguage)` - Start interactive chat session

---

### 3. Core Layer (`src/core/`)

**Purpose**: Business logic and AI functionality

**Key Principle**: Core modules should be UI-agnostic. They process data and return results without any display logic.

#### `agent.js`
- AI agent creation and configuration
- Tool definitions (transcript search, video info)
- Summary generation

**Exports**:
- `createSearchTranscriptTool(vectorStore)` - Create transcript search tool
- `createGetVideoInfoTool(videoMetadata)` - Create video info tool
- `createAgent(vectorStore, videoMetadata, language, userLocale)` - Create configured AI agent
- `generateSummary(agent, videoMetadata, locale)` - Generate video summary

#### `youtube.js`
- YouTube transcript loading
- Video metadata extraction
- Duration fetching

**Exports**:
- `loadYouTubeTranscript(videoId, language, preferEnglish, locale)` - Load transcript with fallback
- `fetchVideoDuration(videoId, locale)` - Fetch video duration
- `extractVideoMetadata(docs, duration)` - Extract metadata from documents

#### `vector-store.js`
- Semantic text chunking
- Vector store creation
- Embeddings management

**Exports**:
- `SemanticChunker` class - Intelligent text splitting based on semantic similarity
- `createVectorStore(docs)` - Create vector store from documents

---

### 4. Services Layer (`src/services/`)

**Purpose**: Reusable services that can be used across the application

#### `config.js`
- Load/save user configuration
- Configuration file management

**Exports**:
- `loadConfig()` - Load configuration from file
- `saveConfig(config, locale)` - Save configuration to file

**Configuration Schema**:
```javascript
{
  language: string | null,        // Language code (e.g., 'en', 'es') or null for auto-detect
  locale: string | null,          // Locale code or null for auto-detect
  preferAccurateTranscript: boolean  // Prefer English transcript for accuracy
}
```

#### `export.js`
- Conversation export formatting
- Clipboard export
- File export

**Exports**:
- `formatConversationForExport(conversationHistory, videoMetadata, youtubeUrl, locale)` - Format conversation
- `exportToClipboard(conversationHistory, videoMetadata, youtubeUrl, locale)` - Export to clipboard
- `exportToFile(conversationHistory, videoMetadata, youtubeUrl, filename, locale)` - Export to file
- `getDefaultExportFilename()` - Generate default filename with timestamp

---

### 5. Utils Layer (`src/utils/`)

**Purpose**: Pure utility functions with no side effects

#### `formatting.js`
- String formatting helpers
- URL parsing
- Timestamp conversion

**Exports**:
- `extractVideoId(url, locale)` - Extract YouTube video ID from URL
- `formatTimestamp(seconds)` - Convert seconds to HH:MM:SS or MM:SS
- `padEndVisual(str, targetWidth, padChar)` - Pad string accounting for wide characters

---

### 6. Localization (`localization.js`)

**Purpose**: Internationalization and localization

**Location**: Root level (unchanged from original)

**Key Functions**:
- `getMessage(key, locale, params)` - Get localized message
- `getLanguageName(code)` - Get language display name
- `detectLocale(config)` - Detect user's locale
- `getLanguageEntries()` - Get available languages

---

## Data Flow

### Initialization Flow
```
index.js
  ↓
loadConfig() → detectLocale()
  ↓
extractVideoId() → loadYouTubeTranscript() → fetchVideoDuration()
  ↓
extractVideoMetadata()
  ↓
createVectorStore()
  ↓
createAgent()
  ↓
generateSummary() → displaySummary()
  ↓
startChat()
```

### Chat Interaction Flow
```
User Input (chat.js)
  ↓
Command Detection (/export, /lang, exit, or regular message)
  ↓
  ├─→ /export → handleExportCommand() → exportToClipboard/File()
  ├─→ /lang → handleLangCommand() → saveConfig()
  ├─→ exit → process.exit()
  └─→ Regular message
        ↓
      agent.invoke()
        ↓
      conversationHistory.push()
        ↓
      displayAssistantResponse()
```

---

## Design Principles

### 1. Separation of Concerns
- **UI code** should never contain business logic
- **Business logic** should never contain UI code
- **Services** should be reusable and stateless when possible

### 2. Dependency Direction
```
UI Layer → Core Layer → Utils Layer
    ↓         ↓
Services Layer
```

- UI depends on Core and Services
- Core depends on Utils and Services
- Services depend on Utils
- Utils have no dependencies (except external libraries)
- **Never** have Core depend on UI

### 3. Single Responsibility
Each module should have one clear purpose. If a file is doing multiple unrelated things, split it.

### 4. Pure Functions Where Possible
Utility functions should be pure (no side effects, deterministic output).

### 5. Dependency Injection
Pass dependencies as function parameters rather than importing them globally within functions.

**Example**:
```javascript
// Good - dependencies passed in
export async function createAgent(vectorStore, videoMetadata, language, userLocale) {
  // ...
}

// Bad - dependencies imported inside
export async function createAgent() {
  const vectorStore = await getVectorStore(); // Hidden dependency
}
```

---

## Adding New Features

### Adding a New UI Component
1. Create file in `src/ui/`
2. Import display utilities from `console.js`
3. Import services/core functions as needed
4. Export functions that orchestrate UI flow
5. Update `index.js` or `chat.js` to use new component

### Adding New Business Logic
1. Create file in `src/core/`
2. Keep it UI-agnostic (no console.log, no spinners)
3. Return data, throw errors - let UI layer handle display
4. Export functions with clear interfaces

### Adding a New Service
1. Create file in `src/services/`
2. Make it reusable across different parts of the app
3. Keep functions stateless when possible
4. Document the service interface clearly

### Adding a New Utility
1. Create file in `src/utils/`
2. Keep functions pure (no side effects)
3. Make functions generic and reusable
4. Add clear JSDoc comments

---

## Testing Strategy

### Unit Tests (Future)
- **Utils**: Easy to test (pure functions)
- **Services**: Test with mocked file system / external dependencies
- **Core**: Test with mocked dependencies (vector store, API clients)

### Integration Tests (Future)
- Test full initialization flow
- Test chat interaction flows
- Test export functionality

### Manual Testing
- Test with various YouTube URLs
- Test all chat commands (`/export`, `/lang`, `exit`)
- Test error scenarios (invalid URLs, network errors)

---

## Common Patterns

### Error Handling
```javascript
// In Core/Services: Throw errors with clear messages
throw new Error(getMessage('error_key', locale));

// In UI: Catch and display
try {
  await coreFunction();
} catch (error) {
  displayError('error_key', locale, { error: error.message });
}

// In index.js: Catch top-level errors
try {
  await initialize();
} catch (error) {
  displayError('error_general', currentLocale, { error: error.message });
  process.exit(1);
}
```

### Spinner Usage
```javascript
// Create and start
const spinner = startSpinner(getMessage('loading_key', locale));

try {
  // Do work
  await someAsyncOperation();

  // Success
  spinner.stop();
  spinner.clear();
  displaySuccess();
} catch (error) {
  // Failure
  spinner.fail();
  displayError('error_key', locale, { error: error.message });
}
```

### Localization
```javascript
// Always use getMessage for user-facing strings
console.log(getMessage('key', locale));
console.log(getMessage('key_with_param', locale, { name: 'value' }));

// Never hardcode strings
console.log("Loading transcript..."); // ❌ Bad
console.log(getMessage('loading_transcript', locale)); // ✅ Good
```

---

## Dependencies Management

### External Dependencies by Layer

**UI Layer**:
- `readline` - User input (line-based with built-in editing)
- `omelette` - Shell completion for commands
- `ora` - Spinners
- `cli-markdown` - Markdown rendering

**Core Layer**:
- `@langchain/community` - YouTube loader
- `@langchain/google-genai` - AI models and embeddings
- `@langchain/classic` - Vector store
- `@langchain/core` - Tools and documents
- `@langchain/langgraph` - Agent creation
- `youtubei.js` - Video metadata

**Services Layer**:
- `fs/promises` - File operations
- `clipboardy` - Clipboard access

**Utils Layer**:
- `string-width` - Visual string width calculation
- `os` - Operating system utilities
- `path` - Path manipulation

---

## Future Improvements

### Potential Enhancements
1. **Add TypeScript** - Type safety across all modules
2. **Add Tests** - Unit and integration tests for all layers
3. **Configuration Validation** - JSON schema validation for config file
4. **Plugin System** - Allow custom tools/commands
5. **Better Error Recovery** - Retry logic for transient failures
6. **Caching** - Cache transcripts and embeddings
7. **Session Management** - Save/load chat sessions
8. **Multiple Video Support** - Compare or analyze multiple videos

### Refactoring Opportunities
1. Extract conversation history management into a separate service
2. Create a dedicated Logger utility for consistent logging
3. Add a validation layer for user inputs
4. Create a state management service for global state

---

## Key Files Reference

| File | Lines | Primary Purpose |
|------|-------|----------------|
| `index.js` | ~133 | Orchestration & initialization |
| `src/ui/console.js` | ~135 | Display formatting & utilities |
| `src/ui/prompts.js` | ~175 | Interactive prompts for /lang and /export |
| `src/ui/chat.js` | ~370 | Chat interface with readline |
| `src/core/agent.js` | ~135 | AI agent & tools |
| `src/core/youtube.js` | ~80 | YouTube data loading |
| `src/core/vector-store.js` | ~150 | Vector store & chunking |
| `src/services/config.js` | ~40 | Config management |
| `src/services/export.js` | ~95 | Export functionality |
| `src/utils/formatting.js` | ~65 | Utility functions |

---

## Questions & Decisions Log

### Why separate `prompts.js` from `chat.js`?
- `chat.js` handles the main chat loop
- `prompts.js` handles complex multi-step interactions (`/export`, `/lang`)
- This keeps `chat.js` focused on the core chat flow

### Why is `conversationHistory` managed in `index.js`?
- It's application-level state that needs to be accessible to multiple modules
- Could be moved to a dedicated state management service in the future

### Why keep `localization.js` at root?
- It's a cross-cutting concern used by all layers
- Moving it would require updating many import paths
- It's stable and doesn't need frequent changes

### Why use dependency injection instead of singletons?
- Makes testing easier (can inject mocks)
- Makes dependencies explicit
- Reduces hidden coupling between modules

### Why use readline instead of raw mode for input?
- **Simplicity**: Readline handles all text editing, cursor movement, and history automatically
- **Reliability**: No flickering or disappearing console messages from screen redraws
- **Shell Integration**: Native tab completion via `omelette` and shell features work properly
- **Standard UX**: Familiar CLI interaction pattern like git, npm, docker
- **Less Code**: ~300 lines of manual keypress handling replaced with ~50 lines of readline
- **No Streaming**: Since AI responses don't stream character-by-character, raw mode isn't needed
- **Better Compatibility**: Works with all terminal emulators and screen readers

The trade-off: No mid-line cursor editing during typing. However, readline still provides arrow keys, backspace, Ctrl+U, Ctrl+K, and other standard editing shortcuts - sufficient for a chat interface.

---

## Contributing Guidelines

When contributing to this project:

1. **Follow the architecture** - Don't mix UI and business logic
2. **Keep modules focused** - Each file should have one clear purpose
3. **Use localization** - All user-facing strings must use `getMessage()`
4. **Document exports** - Add JSDoc comments to exported functions
5. **Handle errors properly** - Throw in Core, catch and display in UI
6. **Test your changes** - Verify the app works end-to-end
7. **Update this doc** - If you add new patterns or make architectural changes

---

## Contact & Support

For questions about this architecture:
- Review this document first
- Check existing code for patterns
- Refer to individual module JSDoc comments

Last Updated: 2025-10-25