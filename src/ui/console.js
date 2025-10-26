import ora from "ora";
import cliMarkdown from "cli-markdown";
import { getMessage, getLanguageName } from "../../localization.js";
import { formatTimestamp } from "../utils/formatting.js";

// ANSI escape codes for styling
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Render markdown to terminal
 * @param {string} text - Text to render as markdown
 * @returns {string} Rendered markdown
 */
export function renderMarkdown(text) {
  try {
    return cliMarkdown(text);
  } catch (error) {
    // If markdown parsing fails, return original text
    return text;
  }
}

/**
 * Display usage information
 * @param {string} locale - Current locale
 */
export function displayUsage(locale) {
  console.log(getMessage('usage_header', locale));
  console.log(getMessage('usage_examples', locale));
  console.log(getMessage('usage_example_1', locale));
  console.log(getMessage('usage_note', locale));
}

/**
 * Display video information
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} locale - Current locale
 */
export function displayVideoInfo(videoMetadata, locale) {
  console.log(getMessage('video_info_title', locale, { title: videoMetadata.title }));
  console.log(getMessage('video_info_author', locale, { author: videoMetadata.author }));
  console.log(getMessage('video_info_duration', locale, { duration: formatTimestamp(videoMetadata.duration) }));
  console.log('');
}

/**
 * Display chat session header
 * @param {string} uiLanguage - UI language code
 * @param {string} transcriptLanguage - Transcript language code
 * @param {string} locale - Current locale
 */
export function displayChatHeader(uiLanguage, transcriptLanguage, locale) {
  console.log("\n" + "=".repeat(60));
  console.log(getMessage('chat_started_with_languages', locale, {
    uiLanguage: getLanguageName(uiLanguage),
    transcriptLanguage: getLanguageName(transcriptLanguage)
  }));
  console.log(getMessage('chat_exit_instruction', locale));
  console.log(getMessage('chat_export_instruction', locale));
  console.log(getMessage('chat_lang_instruction', locale));
  console.log("=".repeat(60) + "\n");
}

/**
 * Create and start a loading spinner
 * @param {string} text - Spinner text
 * @returns {Object} Spinner instance
 */
export function startSpinner(text) {
  return ora({
    text,
    spinner: 'dots'
  }).start();
}

/**
 * Create and start a thinking spinner (non-stdin blocking)
 * @param {string} text - Spinner text
 * @returns {Object} Spinner instance
 */
export function startThinkingSpinner(text) {
  return ora({
    text,
    spinner: 'dots',
    discardStdin: false
  }).start();
}

/**
 * Display assistant response
 * @param {string} content - Response content
 * @param {string} locale - Current locale
 */
export function displayAssistantResponse(content, locale) {
  console.log(`${getMessage('role_assistant', locale)}: ${renderMarkdown(content)}\n`);
}

/**
 * Display error message
 * @param {string} messageKey - Localization key for the error
 * @param {string} locale - Current locale
 * @param {Object} params - Parameters for the message
 */
export function displayError(messageKey, locale, params = {}) {
  console.error(`\n${getMessage(messageKey, locale, params)}\n`);
}

/**
 * Display summary with separator
 * @param {string} content - Summary content
 */
export function displaySummary(content) {
  console.log(renderMarkdown(content));
  console.log("\n" + "=".repeat(60));
}

/**
 * Get terminal width for separator lines
 * @returns {number} Terminal width
 */
export function getTerminalWidth() {
  return process.stdout.columns || 115;
}

/**
 * Create a horizontal separator line
 * @returns {string} Separator line
 */
export function createSeparator() {
  return '─'.repeat(getTerminalWidth());
}

/**
 * Render the entire chat interface
 * @param {Array} chatHistory - Array of chat messages {role: 'user'|'assistant'|'thinking', content: string, isMarkdown: boolean}
 * @param {string} currentInput - Current user input
 * @param {boolean} hasUserTypedOnce - Whether user has typed at least once
 * @param {Array} commandSuggestions - Optional array of command suggestions to show
 * @param {number} cursorPos - Cursor position within the input (default: end of input)
 * @param {boolean} isFirstRender - Whether this is the first render (preserves loading messages if true)
 */
export function renderChatScreen(chatHistory, currentInput, hasUserTypedOnce, commandSuggestions = [], cursorPos = null, isFirstRender = false) {
  if (isFirstRender) {
    // On first render, save the cursor position (this is right after loading messages)
    // We'll return to this position on subsequent renders
    process.stdout.write('\x1b7'); // Save cursor position (ESC 7)
  } else {
    // On subsequent renders, restore cursor to saved position and clear from there down
    process.stdout.write('\x1b8'); // Restore cursor position (ESC 8)
    process.stdout.write('\x1b[J'); // Clear from cursor to end of screen
  }

  // Render chat history
  for (const message of chatHistory) {
    if (message.role === 'user') {
      console.log(`> ${message.content}`);
    } else if (message.role === 'thinking') {
      console.log(`${DIM}└ ${message.content}${RESET}`);
    } else if (message.role === 'assistant') {
      console.log(''); // Blank line before assistant response
      // Render markdown on-demand for proper terminal resize handling
      const displayContent = message.isMarkdown ? renderMarkdown(message.content) : message.content;
      console.log(displayContent);
    }
  }

  // Render separator
  console.log(createSeparator());

  // Render input line with placeholder logic (no newline after)
  if (!hasUserTypedOnce && currentInput.length === 0) {
    // State 1: Cold start - show full placeholder
    process.stdout.write(`> ${DIM}Type your question...${RESET}\n`);
  } else {
    // State 2 & 3: Active typing or post-interaction - show only input
    // Add a space at the end to make cursor visible after last character
    const displayInput = currentInput + ' ';
    process.stdout.write(`> ${displayInput}\n`);
  }

  // Render separator
  console.log(createSeparator());

  // Render command suggestions if any
  if (commandSuggestions.length > 0) {
    console.log(`${DIM}  Suggestions:${RESET}`);
    commandSuggestions.forEach(cmd => {
      console.log(`${DIM}    ${cmd}${RESET}`);
    });
  } else {
    // Render hint
    console.log(`${DIM}  / for commands${RESET}`);
  }

  // Calculate how many lines to move up
  const linesToMoveUp = commandSuggestions.length > 0
    ? 3 + commandSuggestions.length // hint header + suggestions + separator + bottom position
    : 3; // hint line + separator + bottom position

  // Move cursor back up to the input line
  process.stdout.write(`\x1b[${linesToMoveUp}A`);

  // Move cursor to the correct position (default to end of input)
  // Add 1 to cursorPos because terminal cursor should appear BEFORE the character (one space ahead)
  const actualCursorPos = cursorPos !== null ? cursorPos : currentInput.length;
  const cursorColumn = 2 + actualCursorPos + 1; // 2 for "> " prefix, +1 to position cursor ahead
  process.stdout.write(`\x1b[${cursorColumn}G`);
}

/**
 * Display a dim thinking indicator
 * @param {string} text - Text to display (default: "Thinking...")
 * @returns {string} Formatted thinking text
 */
export function formatThinkingIndicator(text = "Thinking...") {
  return `${DIM}└ ${text}${RESET}`;
}

/**
 * Clear the current line in the terminal
 */
export function clearCurrentLine() {
  process.stdout.write('\r\x1b[K');
}

/**
 * Move cursor up by N lines
 * @param {number} lines - Number of lines to move up
 */
export function moveCursorUp(lines) {
  process.stdout.write(`\x1b[${lines}A`);
}

/**
 * Display a command flow header (for /export, /lang)
 * @param {string} title - Header title
 */
export function displayCommandHeader(title) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}
