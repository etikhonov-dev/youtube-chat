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
  let chatHistory = conversationHistory.map(entry => ({
    role: entry.role === 'user' ? 'user' : 'assistant',
    content: entry.role === 'assistant' ? renderMarkdown(entry.content) : entry.content
  }));
  let currentInput = '';
  let hasUserTypedOnce = false;
  let isProcessing = false;

  // Setup autocompletion for commands
  const complete = omelette('youtube-chat');
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

  // Resume stdin to keep the event loop active
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

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

        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
        currentInput = '';
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

        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
        currentInput = '';
        isProcessing = false;
        renderScreen();
        return;
      }

      // Handle regular message with AI agent
      isProcessing = true;
      currentInput = '';

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
        const lastMessage = messages[messages.length - 1];
        const assistantContent = lastMessage.content;

        // Add to conversation history
        conversationHistory.push({
          timestamp: new Date(),
          role: "assistant",
          content: assistantContent,
          fullMessages: messages,
        });

        // Remove thinking indicator
        chatHistory.pop();

        // Add assistant response (render as markdown)
        chatHistory.push({ role: 'assistant', content: renderMarkdown(assistantContent) });

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

      currentInput += str;
      renderScreen();
    }
  });

  // Helper function to render screen
  function renderScreen() {
    renderChatScreen(chatHistory, currentInput, hasUserTypedOnce);
  }

  // Initial render (renderChatScreen will clear the console)
  renderScreen();

  // Return a promise that resolves when the user exits
  // This keeps the function from returning and the process alive
  return new Promise((resolve) => {
    // Store the resolve function so exit handlers can call it
    process.stdin.once('end', resolve);
  });
}
