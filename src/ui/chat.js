import readline from "readline";
import omelette from "omelette";
import { renderChatScreen, displayChatHeader, renderMarkdown } from "./console.js";
import { handleLangCommand as handleLangStub, handleExportCommand as handleExportStub } from "./prompts.js";
import { getMessage } from "../../localization.js";

/**
 * Start the conversational CLI interface (standalone version)
 * @returns {Promise<void>}
 */
export async function startChatInterface() {
  // State management
  let chatHistory = [];
  let currentInput = '';
  let hasUserTypedOnce = false;
  let isProcessing = false;

  // Setup autocompletion for commands
  const complete = omelette('node index.js');
  complete.on('complete', (fragment, data) => {
    if (fragment === '' || fragment === '/') {
      data.reply(['/lang', '/export', '/exit', '/quit']);
    } else if (fragment.startsWith('/')) {
      const commands = ['/lang', '/export', '/exit', '/quit'];
      data.reply(commands.filter(cmd => cmd.startsWith(fragment)));
    }
  });
  complete.init();

  // Enable raw mode for character-by-character input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Handle keypress events
  process.stdin.on('keypress', async (str, key) => {
    if (isProcessing) return;

    // Handle Ctrl+C
    if (key && key.ctrl && key.name === 'c') {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      console.clear();
      console.log("\nGoodbye!\n");
      process.exit(0);
    }

    // Handle backspace
    if (key && key.name === 'backspace') {
      if (currentInput.length > 0) {
        currentInput = currentInput.slice(0, -1);
        renderScreen();
      }
      return;
    }

    // Handle Enter
    if (key && key.name === 'return') {
      const userInput = currentInput.trim();

      // Handle empty input
      if (!userInput) {
        currentInput = '';
        renderScreen();
        return;
      }

      // Mark that user has typed once
      if (!hasUserTypedOnce) {
        hasUserTypedOnce = true;
      }

      // Handle commands
      if (userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === '/quit') {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.clear();
        console.log("\nGoodbye!\n");
        process.exit(0);
      }

      if (userInput.toLowerCase() === '/lang') {
        isProcessing = true;
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.clear();
        await handleLangCommand();
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
        currentInput = '';
        cursorPosition = 0;
        isProcessing = false;
        renderScreen();
        return;
      }

      if (userInput.toLowerCase() === '/export') {
        isProcessing = true;
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.clear();
        await handleExportCommand();
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
        currentInput = '';
        cursorPosition = 0;
        isProcessing = false;
        renderScreen();
        return;
      }

      // Handle regular message
      isProcessing = true;
      currentInput = '';

      // Add user message to history
      chatHistory.push({ role: 'user', content: userInput });

      // Add thinking indicator
      chatHistory.push({ role: 'thinking', content: 'Thinking...' });

      // Render with thinking indicator
      renderScreen();

      // Simulate assistant response
      setTimeout(() => {
        // Remove thinking indicator
        chatHistory.pop();

        // Add assistant response
        const response = generateSimulatedResponse(userInput);
        chatHistory.push({ role: 'assistant', content: response });

        // Reset state
        isProcessing = false;
        currentInput = '';

        // Render final state
        renderScreen();
      }, 1500);

      return;
    }

    // Handle regular characters
    if (str && !key.ctrl && !key.meta) {
      // Mark that user has typed once
      if (!hasUserTypedOnce) {
        hasUserTypedOnce = true;
      }

      currentInput += str;
      renderScreen();
    }
  });

  // Helper function to render screen
  function renderScreen() {
    renderChatScreen(chatHistory, currentInput, hasUserTypedOnce);
  }

  // Initial render
  renderScreen();

  // Keep process alive
  return new Promise(() => {});
}

/**
 * Generate a simulated assistant response
 * @param {string} userInput - User's input message
 * @returns {string} Simulated response
 */
function generateSimulatedResponse(userInput) {
  const responses = {
    'what about culture': 'Culture involves shared values, traditions, and practices that shape communities.',
    'hello': 'Hello! How can I help you today?',
    'hi': 'Hi there! What would you like to know?',
    'help': 'You can ask me questions or use commands like /lang, /export, /exit.'
  };

  const lowerInput = userInput.toLowerCase();

  if (responses[lowerInput]) {
    return responses[lowerInput];
  }

  // Default response
  return `You asked: "${userInput}". This is a simulated response. In a full implementation, this would be replaced with actual AI agent responses.`;
}

/**
 * Start the interactive chat session with new conversational UI
 * @param {Object} agent - Agent instance
 * @param {Array} conversationHistory - Array to store conversation history
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} youtubeUrl - YouTube video URL
 * @param {string} locale - Current locale
 * @param {string} uiLanguage - UI language code
 * @param {string} transcriptLanguage - Transcript language code
 * @returns {Promise<void>}
 */
export async function startChat(agent, conversationHistory, videoMetadata, youtubeUrl, locale, uiLanguage, transcriptLanguage) {
  // Import original prompts handlers
  const { handleExportCommand, handleLangCommand } = await import('./prompts-original.js');

  // State management - initialize with existing conversation history
  // Only show the summary once at the start
  // Store raw content in chatHistory, render markdown on-demand for proper terminal resize handling
  let chatHistory = [];
  if (conversationHistory.length > 0) {
    // Assuming the first entry is the summary
    const summaryEntry = conversationHistory[0];
    if (summaryEntry && summaryEntry.role === 'assistant') {
      chatHistory.push({
        role: 'assistant',
        content: summaryEntry.content,
        isMarkdown: true
      });
    }
  }
  let currentInput = '';
  let cursorPosition = 0; // Track cursor position within the input
  let hasUserTypedOnce = false;
  let isProcessing = false;
  let isFirstRender = true; // Track if this is the first render to preserve loading messages

  // Note: omelette autocomplete doesn't work in raw mode
  // Raw mode intercepts all keystrokes before the shell can process them
  // For now, autocomplete is disabled in the new interface

  // Enable raw mode for character-by-character input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Resume stdin to keep the event loop active
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  // Handle terminal resize events (e.g., when cmd+b toggles sidebar in VSCode)
  process.stdout.on('resize', () => {
    if (!isProcessing) {
      renderScreen();
    }
  });

  // Handle keypress events
  process.stdin.on('keypress', async (str, key) => {
    if (isProcessing) return;

    // Handle Ctrl+C
    if (key && key.ctrl && key.name === 'c') {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      console.clear();
      console.log(`\n${getMessage('chat_goodbye', locale)}\n`);
      process.exit(0);
    }

    // Handle Option+Left (often sends 'b' on Mac terminals for word back)
    if (key && (key.name === 'b' && key.meta)) {
      // Option+Left: jump to previous word
      if (cursorPosition > 0) {
        // Skip current whitespace
        while (cursorPosition > 0 && currentInput[cursorPosition - 1] === ' ') {
          cursorPosition--;
        }
        // Skip to start of current/previous word
        while (cursorPosition > 0 && currentInput[cursorPosition - 1] !== ' ') {
          cursorPosition--;
        }
        renderScreen();
      }
      return;
    }

    // Handle left arrow - move cursor left
    if (key && key.name === 'left') {
      // Regular left: move one character
      if (cursorPosition > 0) {
        cursorPosition--;
        renderScreen();
      }
      return;
    }

    // Handle Option+Right (often sends 'f' on Mac terminals for word forward)
    if (key && (key.name === 'f' && key.meta)) {
      // Option+Right: jump to next word
      if (cursorPosition < currentInput.length) {
        // Skip current whitespace
        while (cursorPosition < currentInput.length && currentInput[cursorPosition] === ' ') {
          cursorPosition++;
        }
        // Skip to end of current/next word
        while (cursorPosition < currentInput.length && currentInput[cursorPosition] !== ' ') {
          cursorPosition++;
        }
        renderScreen();
      }
      return;
    }

    // Handle right arrow - move cursor right
    if (key && key.name === 'right') {
      // Regular right: move one character
      if (cursorPosition < currentInput.length) {
        cursorPosition++;
        renderScreen();
      }
      return;
    }

    // Handle Tab for command autocomplete
    if (key && key.name === 'tab') {
      // Find the word at cursor position
      const beforeCursor = currentInput.substring(0, cursorPosition);
      const afterCursor = currentInput.substring(cursorPosition);
      const lastSpaceIndex = beforeCursor.lastIndexOf(' ');
      const currentWord = lastSpaceIndex === -1 ? beforeCursor : beforeCursor.substring(lastSpaceIndex + 1);

      if (currentWord.startsWith('/')) {
        const commands = ['/lang', '/export', '/exit', '/quit'];
        const matches = commands.filter(cmd => cmd.startsWith(currentWord));
        if (matches.length === 1) {
          // Replace current word with the matched command
          const before = lastSpaceIndex === -1 ? '' : currentInput.substring(0, lastSpaceIndex + 1);
          currentInput = before + matches[0] + afterCursor;
          cursorPosition = (before + matches[0]).length;
          renderScreen();
        }
      }
      return;
    }

    // Handle backspace
    if (key && key.name === 'backspace') {
      if (cursorPosition > 0) {
        currentInput = currentInput.slice(0, cursorPosition - 1) + currentInput.slice(cursorPosition);
        cursorPosition--;
        renderScreen();
      }
      return;
    }

    // Handle Enter
    if (key && key.name === 'return') {
      const userInput = currentInput.trim();

      // Handle empty input
      if (!userInput) {
        currentInput = '';
        renderScreen();
        return;
      }

      // Mark that user has typed once
      if (!hasUserTypedOnce) {
        hasUserTypedOnce = true;
      }

      // Check if this looks like a command attempt mixed with text
      if (userInput.includes('/') && !userInput.startsWith('/')) {
        // User typed text then /command - show a hint that it was treated as regular text
        chatHistory.push({
          role: 'assistant',
          content: 'Note: Commands must start with / (e.g., /lang, /export). Your message was treated as regular text.'
        });
        renderScreen();
      }

      // Handle commands
      if (userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === '/quit') {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.clear();
        console.log(`\n${getMessage('chat_goodbye', locale)}\n`);
        process.exit(0);
      }

      if (userInput.toLowerCase() === '/lang') {
        isProcessing = true;
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.clear();

        // Create a readline interface for the command handler
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        await handleLangCommand(rl, locale);
        rl.close();

        // Re-setup keypress events after closing readline interface
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
        readline.emitKeypressEvents(process.stdin);
        process.stdin.resume();

        currentInput = '';
        cursorPosition = 0;
        isProcessing = false;
        renderScreen();
        return;
      }

      if (userInput.toLowerCase() === '/export') {
        isProcessing = true;
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.clear();

        // Create a readline interface for the command handler
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        await handleExportCommand(rl, conversationHistory, videoMetadata, youtubeUrl, locale);
        rl.close();

        // Re-setup keypress events after closing readline interface
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
        readline.emitKeypressEvents(process.stdin);
        process.stdin.resume();

        currentInput = '';
        cursorPosition = 0;
        isProcessing = false;
        renderScreen();
        return;
      }

      // Handle regular message with AI agent
      isProcessing = true;
      currentInput = '';
      cursorPosition = 0;

      // Add user message to history
      chatHistory.push({ role: 'user', content: userInput });

      // Add to conversation history
      conversationHistory.push({
        timestamp: new Date(),
        role: "user",
        content: userInput,
      });

      // Add thinking indicator
      chatHistory.push({ role: 'thinking', content: 'Thinking...' });

      // Render with thinking indicator
      renderScreen();

      // Get AI response
      try {
        const response = await agent.invoke({
          messages: [{ role: "user", content: userInput }],
        });

        const messages = response.messages;

        // Filter to get ONLY AI/assistant messages (not tool calls or tool responses)
        const aiMessages = messages.filter(msg => {
          const msgType = msg._getType ? msg._getType() : msg.constructor.name;
          return msgType === 'ai' || msgType === 'AIMessage';
        });

        // Get the last AI message (the final response)
        const lastAIMessage = aiMessages.length > 0 ? aiMessages[aiMessages.length - 1] : messages[messages.length - 1];
        const assistantContent = lastAIMessage.content;

        // Add to conversation history
        conversationHistory.push({
          timestamp: new Date(),
          role: "assistant",
          content: assistantContent,
          fullMessages: messages,
        });

        // Remove thinking indicator
        chatHistory.pop();

        // Add assistant response (store raw content, render on-demand)
        chatHistory.push({ role: 'assistant', content: assistantContent, isMarkdown: true });

      } catch (error) {
        // Remove thinking indicator
        chatHistory.pop();

        // Add error message
        chatHistory.push({ role: 'assistant', content: `Error: ${error.message}` });
      }

      // Reset state
      isProcessing = false;
      currentInput = '';

      // Render final state
      renderScreen();

      return;
    }

    // Handle regular characters
    if (str && !key.ctrl && !key.meta) {
      // Mark that user has typed once
      if (!hasUserTypedOnce) {
        hasUserTypedOnce = true;
      }

      // Insert character at cursor position
      currentInput = currentInput.slice(0, cursorPosition) + str + currentInput.slice(cursorPosition);
      cursorPosition++;
      renderScreen();
    }
  });

  // Helper function to render screen
  function renderScreen() {
    // Show command suggestions if the current word (where cursor is) starts with "/"
    let commandSuggestions = [];

    // Find the word at cursor position
    const beforeCursor = currentInput.substring(0, cursorPosition);
    const lastSpaceIndex = beforeCursor.lastIndexOf(' ');
    const currentWord = lastSpaceIndex === -1 ? beforeCursor : beforeCursor.substring(lastSpaceIndex + 1);

    // Check if current word starts with "/"
    if (currentWord.startsWith('/')) {
      const commands = ['/lang', '/export', '/exit', '/quit'];
      commandSuggestions = commands.filter(cmd => cmd.startsWith(currentWord) && cmd !== currentWord);
    }

    renderChatScreen(chatHistory, currentInput, hasUserTypedOnce, commandSuggestions, cursorPosition, isFirstRender);

    // After first render, set flag to false so subsequent renders don't clear loading messages
    if (isFirstRender) {
      isFirstRender = false;
    }
  }

  // Initial render (will NOT clear the console to preserve loading messages)
  renderScreen();

  // Return a promise that resolves when the user exits
  // This keeps the function from returning and the process alive
  return new Promise((resolve) => {
    // Store the resolve function so exit handlers can call it
    process.stdin.once('end', resolve);
  });
}
