import readline from "readline";
import { renderMarkdown, createSeparator, displaySummary, displayReadyMessage } from "./console.js";
import { handleLangCommand, handleExportCommand } from "./prompts.js";
import { getMessage } from "../../localization.js";
import { createInputHandler } from "./input-handler.js";
import { getCommand, getAllCommandNames } from "./commands.js";
import { generateSummary } from "../core/agent.js";

// ANSI escape codes
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Display chat history
 * @param {Array} chatHistory - Array of chat messages
 */
function displayChatHistory(chatHistory) {
  for (const message of chatHistory) {
    if (message.role === 'user') {
      console.log(`> ${message.content}`);
    } else if (message.role === 'assistant') {
      console.log('');
      const displayContent = message.isMarkdown ? renderMarkdown(message.content) : message.content;
      console.log(displayContent);
    }
  }
}

/**
 * Start the interactive chat session with readline
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
  // State management - start with empty chat history (no auto-summary)
  let chatHistory = [];

  // Create readline interface with built-in tab completion
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    completer: (line) => {
      // Only autocomplete if line starts with /
      if (line.startsWith('/')) {
        const commands = getAllCommandNames();
        const hits = commands.filter(cmd => cmd.startsWith(line));
        return [hits.length ? hits : commands, line];
      }
      return [[], line];
    }
  });

  // Create input handler for "/" trigger (before executeCommand so it can use it)
  const inputHandler = createInputHandler();
  inputHandler.attachKeypressHandler(rl);

  // Helper function to execute commands
  const executeCommand = async (commandName) => {
    switch (commandName) {
      case '/summarize':
        try {
          // Show generating message with proper line handling for later cleanup
          console.log(`${DIM}${getMessage('summary_generating', locale)}${RESET}`);
          const summaryContent = await generateSummary(agent, videoMetadata, locale);

          // Clear the "Generating..." message line
          process.stdout.write('\r\x1b[K');
          process.stdout.write('\x1b[1A\r\x1b[K');

          // Add summary to conversation history
          conversationHistory.push({
            timestamp: new Date(),
            role: "assistant",
            content: summaryContent,
          });

          // Add to chat history
          chatHistory.push({
            role: 'assistant',
            content: summaryContent,
            isMarkdown: true
          });

          // Display the summary immediately (don't wait for displayChatHistory below)
          console.log('');
          console.log(renderMarkdown(summaryContent));

          // Skip the redisplay logic below by showing prompt directly
          console.log('');
          inputHandler.resetState();
          rl.prompt();
          return; // Early return to avoid redisplaying chat history
        } catch (error) {
          // Clear the "Generating..." message line if it exists
          process.stdout.write('\r\x1b[K');
          process.stdout.write('\x1b[1A\r\x1b[K');

          console.log(`${getMessage('error_generating_summary', locale, { error: error.message })}\n`);
        }
        break;

      case '/export':
        // Clear readline display before showing export menu
        // Note: We don't pause readline - the selectionPromptActive flag prevents interference
        rl.line = '';
        rl.cursor = 0;
        process.stdout.write('\r\x1b[K'); // Clear current line

        await handleExportCommand(conversationHistory, videoMetadata, youtubeUrl, locale);

        // Give time for any pending input to be flushed
        await new Promise(resolve => setTimeout(resolve, 50));

        // Restore readline display after export
        rl.line = '';
        rl.cursor = 0;
        rl.historyIndex = -1; // Reset history position
        console.log('');
        inputHandler.resetState();
        rl.prompt();
        return;

      case '/lang':
        await handleLangCommand(rl, locale);
        // Note: handleLangCommand may exit the process if config is changed
        break;

      case '/model':
        // TODO: Implement model selection
        console.log(`${DIM}Model selection coming soon...${RESET}\n`);
        inputHandler.resetState();
        rl.prompt();
        return; // Early return

      case '/quit':
      case '/exit':
        rl.close();
        console.clear();
        console.log(`\n${getMessage('chat_goodbye', locale)}\n`);
        process.exit(0);
    }

    // Fallback: redisplay chat history after command (shouldn't normally reach here)
    displayChatHistory(chatHistory);
    console.log('');
    inputHandler.resetState(); // Reset input handler state for fresh input
    rl.prompt();
  };

  // Track if we need to redraw separator on resize
  let lastSeparator = createSeparator();

  // Handle terminal resize events
  process.stdout.on('resize', () => {
    lastSeparator = createSeparator();
  });

  // Display ready message with suggested questions
  displayReadyMessage(locale);

  // Show separator and commands hint
  console.log(lastSeparator);
  console.log(`${DIM}  Commands: /summarize /export /lang /model /quit (Ctrl+C)${RESET}`);
  console.log(lastSeparator);
  console.log('');

  // Set prompt and show it
  rl.setPrompt('> ');
  rl.prompt();

  // Handle line input
  rl.on('line', async (input) => {
    // Ignore line events when dropdown is visible - keypress handler will handle it
    if (inputHandler.isDropdownVisible()) {
      return;
    }

    const trimmed = input.trim();

    // Handle empty input
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Check if it's a command
    const cmd = getCommand(trimmed);
    if (cmd) {
      // Move up one line, clear it, then display the full command
      process.stdout.write('\x1b[1A\r\x1b[K');
      console.log(`> ${cmd.name}`);
      await executeCommand(cmd.name);
      return;
    }

    // Handle regular message
    chatHistory.push({ role: 'user', content: trimmed });
    conversationHistory.push({
      timestamp: new Date(),
      role: "user",
      content: trimmed,
    });

    // Show thinking indicator
    console.log(`${DIM}└ Thinking...${RESET}`);

    try {
      // Get AI response
      const response = await agent.invoke({
        messages: [{ role: "user", content: trimmed }],
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

      // Add to chat history
      chatHistory.push({ role: 'assistant', content: assistantContent, isMarkdown: true });

      // Clear the thinking indicator line and move up
      process.stdout.write('\r\x1b[K');
      process.stdout.write('\x1b[1A\r\x1b[K');

      // Display the response
      console.log('');
      console.log(renderMarkdown(assistantContent));

    } catch (error) {
      // Clear the thinking indicator
      process.stdout.write('\r\x1b[K');
      process.stdout.write('\x1b[1A\r\x1b[K');

      // Display error
      const errorMessage = `Error: ${error.message}`;
      console.log('');
      console.log(errorMessage);
      chatHistory.push({ role: 'assistant', content: errorMessage });
    }

    // Show clean prompt for next input
    console.log('');
    inputHandler.resetState();
    rl.prompt();
  });

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    rl.close();
    console.clear();
    console.log(`\n${getMessage('chat_goodbye', locale)}\n`);
    process.exit(0);
  });

  // Return a promise that keeps the process alive
  return new Promise((resolve) => {
    rl.on('close', () => {
      resolve();
    });
  });
}

/**
 * Start the conversational CLI interface (standalone version for testing)
 * @returns {Promise<void>}
 */
export async function startChatInterface() {
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    completer: (line) => {
      if (line.startsWith('/')) {
        const commands = ['/lang', '/export', '/exit', '/quit'];
        const hits = commands.filter(cmd => cmd.startsWith(line));
        return [hits.length ? hits : commands, line];
      }
      return [[], line];
    }
  });

  let chatHistory = [];

  // Create input handler for "/" trigger
  const inputHandler = createInputHandler();
  inputHandler.attachKeypressHandler(rl);

  console.log(`${DIM}Welcome! Type your message or use / for commands${RESET}\n`);
  console.log(createSeparator());
  console.log(`${DIM}  Commands: /export /lang /model /quit (Ctrl+C)${RESET}`);
  console.log(createSeparator());
  console.log('');

  rl.prompt();

  rl.on('line', async (input) => {
    // Ignore line events when dropdown is visible - keypress handler will handle it
    if (inputHandler.isDropdownVisible()) {
      return;
    }

    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed.toLowerCase() === '/exit' || trimmed.toLowerCase() === '/quit') {
      process.stdout.write('\x1b[1A\r\x1b[K');
      console.log(`> ${trimmed}`);
      rl.close();
      console.clear();
      console.log("\nGoodbye!\n");
      process.exit(0);
    }

    if (trimmed.toLowerCase() === '/lang') {
      process.stdout.write('\x1b[1A\r\x1b[K');
      console.log(`> ${trimmed}`);
      console.clear();
      await handleLangCommand(rl, 'en');
      displayHistory();
      console.log('');
      inputHandler.resetState();
      rl.prompt();
      return;
    }

    if (trimmed.toLowerCase() === '/export') {
      process.stdout.write('\x1b[1A\r\x1b[K');
      console.log(`> ${trimmed}`);
      // Clear readline display before showing export menu
      // Note: We don't pause readline - the selectionPromptActive flag prevents interference
      rl.line = '';
      rl.cursor = 0;
      process.stdout.write('\r\x1b[K'); // Clear current line

      await handleExportCommand(chatHistory, {}, '', 'en');

      // Give time for any pending input to be flushed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Restore readline display after export
      rl.line = '';
      rl.cursor = 0;
      rl.historyIndex = -1; // Reset history position
      console.log('');
      inputHandler.resetState();
      rl.prompt();
      return;
    }

    // Handle regular message
    chatHistory.push({ role: 'user', content: trimmed });
    console.log(`${DIM}└ Thinking...${RESET}`);

    // Simulate response
    setTimeout(() => {
      process.stdout.write('\r\x1b[K\x1b[1A\r\x1b[K');

      const response = generateSimulatedResponse(trimmed);
      chatHistory.push({ role: 'assistant', content: response });

      console.log('');
      console.log(response);
      console.log('');
      inputHandler.resetState();
      rl.prompt();
    }, 1000);
  });

  function displayHistory() {
    for (const msg of chatHistory) {
      if (msg.role === 'user') {
        console.log(`> ${msg.content}`);
      } else {
        console.log('');
        console.log(msg.content);
      }
    }
  }

  rl.on('SIGINT', () => {
    rl.close();
    console.clear();
    console.log("\nGoodbye!\n");
    process.exit(0);
  });

  return new Promise((resolve) => {
    rl.on('close', resolve);
  });
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

  return `You asked: "${userInput}". This is a simulated response. In a full implementation, this would be replaced with actual AI agent responses.`;
}
