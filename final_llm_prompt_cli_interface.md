# 🧠 Final LLM Prompt — Node.js Conversational CLI Interface (Architecture-Aware + UX-Aligned)

You are an expert Node.js CLI UX engineer.  
Write production-ready Node.js code for a **Claude Code-style conversational terminal interface** integrated into an existing project structure (see below).  
Use **only the `readline` and `omelette` packages** for input and autocompletion.

---
## 📁 Project structure context
The repository already has:
```
youtube-chat/
├── index.js                    # Entry point - orchestration only
├── localization.js             # Localization/i18n system
├── src/
│   ├── ui/
│   │   ├── console.js          # Console display & formatting
│   │   ├── prompts.js          # User prompts & interactive commands
│   │   └── chat.js             # Chat interface controller
│   ├── core/
│   │   ├── agent.js
│   │   ├── youtube.js
│   │   └── vector-store.js
│   ├── services/
│   │   ├── config.js
│   │   └── export.js
│   └── utils/
│       └── formatting.js
└── ARCHITECTURE.md
```

You will update or add code primarily in:
- `src/ui/chat.js` — main chat interface logic and event loop  
- `src/ui/console.js` — handles screen redraws, chat history display, dim placeholders, and separators  
- `src/ui/prompts.js` — manages interactive command confirmation or argument input  

The top-level `index.js` simply initializes and calls `startChatInterface()` from `src/ui/chat.js`.

---
## 🎯 Functional goals
- Maintain a **scrolling chat history** where new messages push older ones upward.  
- Keep the **input line** always focused at the bottom of the terminal.  
- When user presses **Enter**:
  - The message moves up into chat, prefixed with `>`.  
  - Immediately show a **dim "└ Thinking…"** indicator below it.  
  - After a short simulated delay (`setTimeout`), replace it with the assistant's text reply.  
- Between the user message and assistant reply, include **one blank line** (no "Assistant:" label).  
- **On cold start only**, show a **dim placeholder:** `Type your question…` prefixed with `>`.  
- As soon as the user starts typing for the first time, switch to an **active input state** (no placeholder, just cursor after `>`).  
- **After the first interaction**, when input becomes empty again, show only `>` with cursor — **never revert to the full placeholder**.
- Below the separator line, show a **dim hint:** `/ for commands`.  
- Support autocompletion for `/` commands via `omelette`.

---
## 💬 Supported commands
Only these commands are available:
- `/lang` → triggers **existing language confirmation flow** (already implemented elsewhere).  
- `/export` → triggers **existing export confirmation flow**.  
- `/exit` or `/quit` (or **Ctrl+C**) → exits gracefully with a short goodbye message.

Stub functions for integration:
```js
async function handleLangCommand() { console.log("(Language change flow here)"); }
async function handleExportCommand() { console.log("(Export flow here)"); }
```

---
## 🧱 Design requirements
- No box borders. Use horizontal separators with `─`.  
- Use **ANSI escape codes** for dim/colored text.  
- Redraw entire chat area on updates (`console.clear()` + reprint).  
- Preserve cursor focus on input after each redraw.  
- Single-line input only (no multiline).  
- Keep the interface readable on dark terminal backgrounds.

---
## 🎨 UX State Machine — Progressive Invitation Model

The interface should follow a **three-state model** that adapts to the user's interaction history:

### State 1: Cold Start (First Launch)
**When:** User hasn't typed anything yet in the session  
**Purpose:** Friendly invitation that reduces cognitive friction

```
─────────────────────────────────────────────
> Type your question...                (dim text)
─────────────────────────────────────────────
  / for commands                       (dim hint)
```

**Key behaviors:**
- Full placeholder text visible: `Type your question...` (dimmed)
- Helps new users instantly understand what to do
- Creates a welcoming, low-pressure entry point

### State 2: Active Typing (During Input)
**When:** User is actively typing or has typed at least once  
**Purpose:** Minimal visual noise, maximum focus on content

```
─────────────────────────────────────────────
> █
─────────────────────────────────────────────
  / for commands                       (dim hint)
```

**Key behaviors:**
- Placeholder disappears immediately when typing starts
- Only `>` prompt and blinking cursor visible
- Clean, distraction-free typing experience
- User already knows where to type — no need for hints

### State 3: Returning to Empty (Post-Interaction)
**When:** User has sent at least one message, then clears input  
**Purpose:** Professional "in conversation" feel

```
─────────────────────────────────────────────
> █
─────────────────────────────────────────────
  / for commands                       (dim hint)
```

**Key behaviors:**
- **Never show full placeholder again** after first interaction
- Only show `>` with cursor — feels like ongoing conversation
- Mimics professional CLI tools (git, docker, etc.)
- Communicates "we're in a session now" without being verbose

### Implementation Notes:
- Track a session flag: `hasUserTypedOnce` (boolean)
- On first keypress: set flag to `true`, never reset
- Placeholder logic:
  ```js
  if (!hasUserTypedOnce && input.length === 0) {
    // Show: "> Type your question..." (dim)
  } else if (input.length === 0) {
    // Show: "> █" (just cursor)
  } else {
    // Show: "> [user's text]█"
  }
  ```

---
## 🧩 Example Terminal Layout (expected behavior)

**When chat is active:**
```
> what about culture
└ Thinking...
```
Then updates to:
```
> what about culture

Culture involves shared values, traditions, and practices that shape communities.
```

**When idle (cold start, no typing yet):**
```
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
> Type your question...                (dim text)
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  / for commands                       (dim hint)
```

**When focused or typing (first time):**
```
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
> what█
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  / for commands                       (dim hint)
```

**When returning to empty input (after first message sent):**
```
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
> █
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  / for commands                       (dim hint)
```

**When a command is typed:**
```
> /lang
(Language change flow here)
```

---
## ⚙️ Implementation notes
- Use `readline` for input handling and history.  
- Use `omelette` for `/` command autocompletion.  
- Simulate assistant replies using `setTimeout` to show realistic "thinking".  
- Keep functions small, modular, and cleanly separated across the three UI files.  
- **Implement state tracking** for `hasUserTypedOnce` to enable progressive invitation model.
- Output full working code for:
  - `src/ui/chat.js`
  - `src/ui/console.js`
  - `src/ui/prompts.js`
- Assume `index.js` only calls `startChatInterface()` from `src/ui/chat.js`.
- The output should be directly runnable with:
  ```bash
  npm install omelette
  node index.js
  ```

Focus on **clean UX, smooth redraws, and integration with existing confirmation flows** rather than AI or localization internals.

---
## 🎯 Visual Polish Checklist
- ✅ Placeholder only shows on true cold start
- ✅ Placeholder disappears immediately on first keypress
- ✅ After first message, empty input shows only `>` + cursor
- ✅ "Thinking..." indicator appears immediately after Enter
- ✅ Blank line between user message and assistant response
- ✅ Separator lines use `─` character (not `=` or `-`)
- ✅ All hints and placeholders use dim ANSI codes
- ✅ Cursor always visible and focused at input line