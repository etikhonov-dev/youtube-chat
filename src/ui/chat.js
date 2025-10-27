import readline from "readline";
import { renderMarkdown, createSeparator } from "./console.js";
import { handleLangCommand, handleExportCommand } from "./prompts.js";
import { getMessage } from "../../localization.js";
import { createInputHandler } from "./input-handler.js";
import { getCommand, getAllCommandNames } from "./commands.js";

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
  // State management - initialize with existing conversation history
  let chatHistory = [];
  if (conversationHistory.length > 0) {
    // Show the summary at the start
    const summaryEntry = conversationHistory[0];
    if (summaryEntry && summaryEntry.role === 'assistant') {
      chatHistory.push({
        role: 'assistant',
        content: summaryEntry.content,
        isMarkdown: true
      });
    }
  }

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

  // Helper function to execute commands
  const executeCommand = async (commandName) => {
    console.clear();

    switch (commandName) {
      case '/export':
        await handleExportCommand(rl, conversationHistory, videoMetadata, youtubeUrl, locale);
        break;

      case '/lang':
        await handleLangCommand(rl, locale);
        // Note: handleLangCommand may exit the process if config is changed
        break;

      case '/model':
        // TODO: Implement model selection
        console.log(`${DIM}Model selection coming soon...${RESET}\n`);
        break;

      case '/quit':
      case '/exit':
        rl.close();
        console.clear();
        console.log(`\n${getMessage('chat_goodbye', locale)}\n`);
        process.exit(0);
        break;
    }

    // Redisplay chat after command
    displayChatHistory(chatHistory);
    console.log('');
    rl.prompt();
  };

  // Create input handler for "/" trigger
  const inputHandler = createInputHandler(executeCommand);
  inputHandler.attachKeypressHandler(rl);

  // Track if we need to redraw separator on resize
  let lastSeparator = createSeparator();

  // Handle terminal resize events
  process.stdout.on('resize', () => {
    lastSeparator = createSeparator();
  });

  // Display initial chat history if any
  if (chatHistory.length > 0) {
    displayChatHistory(chatHistory);
    console.log(''); // Blank line after history
  }

  // Show initial separator and hint
  console.log(lastSeparator);
  console.log(`${DIM}  Commands: /export /lang /model /quit (Ctrl+C)${RESET}`);
  console.log(lastSeparator);
  console.log('');

  // Set prompt and show it
  rl.setPrompt('> ');
  rl.prompt();

  // Handle line input
  rl.on('line', async (input) => {
    const trimmed = input.trim();

    // Handle empty input
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Check if it's a command
    const cmd = getCommand(trimmed);
    if (cmd) {
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

  console.log(`${DIM}Welcome! Type your message or use / for commands${RESET}\n`);
  console.log(createSeparator());
  console.log(`${DIM}  Commands: /export /lang /model /quit (Ctrl+C)${RESET}`);
  console.log(createSeparator());
  console.log('');

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed.toLowerCase() === '/exit' || trimmed.toLowerCase() === '/quit') {
      rl.close();
      console.clear();
      console.log("\nGoodbye!\n");
      process.exit(0);
    }

    if (trimmed.toLowerCase() === '/lang') {
      console.clear();
      await handleLangCommand(rl, 'en');
      displayHistory();
      console.log('');
      rl.prompt();
      return;
    }

    if (trimmed.toLowerCase() === '/export') {
      console.clear();
      await handleExportCommand(rl, chatHistory, {}, '', 'en');
      displayHistory();
      console.log('');
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
