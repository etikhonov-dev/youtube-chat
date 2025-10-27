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
 * Display ready message with suggested questions
 * @param {string} locale - Current locale
 */
export function displayReadyMessage(locale) {
  console.log(getMessage('ready_message', locale));
  console.log('');
  console.log(getMessage('suggested_questions_header', locale));
  console.log(`   • "${getMessage('suggested_question_1', locale)}"`);
  console.log(`   • "${getMessage('suggested_question_2', locale)}"`);
  console.log(`   • "${getMessage('suggested_question_3', locale)}"`);
  console.log(`   • "${getMessage('suggested_question_4', locale)}"`);
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


