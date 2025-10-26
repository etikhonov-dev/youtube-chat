#!/usr/bin/env node

import { getMessage, detectLocale } from "./localization.js";
import { loadConfig } from "./src/services/config.js";
import { extractVideoId } from "./src/utils/formatting.js";
import { loadYouTubeTranscript, fetchVideoDuration, extractVideoMetadata } from "./src/core/youtube.js";
import { createVectorStore } from "./src/core/vector-store.js";
import { createAgent, generateSummary } from "./src/core/agent.js";
import { displayUsage, displayVideoInfo, startSpinner, displaySummary, displayError } from "./src/ui/console.js";
import { startChat } from "./src/ui/chat.js";

// Suppress [YOUTUBEJS][Parser] and [YOUTUBEJS][Text] warnings
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(" ");
  if (message.includes("[YOUTUBEJS][Parser]") || message.includes("[YOUTUBEJS][Text]")) {
    return; // Ignore these warnings
  }
  originalConsoleWarn.apply(console, args);
};

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // Get user's locale for showing localized usage message
  const config = await loadConfig();
  const { locale } = detectLocale(config);
  displayUsage(locale);
  process.exit(1);
}

const youtubeUrl = args[0];

// Global variables to store data
let conversationHistory = [];
let currentLocale = 'en'; // Will be set during initialization

/**
 * Initialize the system
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Initialization result with language, locale, and data
 */
async function initialize(config) {
  // Detect locale from config or system
  const { language, locale: userLocale } = detectLocale(config);
  currentLocale = userLocale; // Set global locale for error messages

  console.log('');

  const spinner = startSpinner(getMessage('loading_transcript', userLocale));

  try {
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl, userLocale);

    // Load YouTube transcript
    const preferEnglish = config.preferAccurateTranscript === true;
    const { docs, actualLanguage } = await loadYouTubeTranscript(
      videoId,
      language,
      preferEnglish,
      userLocale
    );

    // Update spinner if fallback occurred
    if (actualLanguage === 'en' && language !== 'en') {
      spinner.text = getMessage('transcript_fallback', userLocale, { language: language.toUpperCase() });
    }

    // Fetch video duration
    const duration = await fetchVideoDuration(videoId, userLocale);

    // Extract video metadata
    const videoMetadata = extractVideoMetadata(docs, duration);

    spinner.stop();
    spinner.clear();

    displayVideoInfo(videoMetadata, userLocale);

    // Create vector store
    const vectorStore = await createVectorStore(docs);

    return {
      language,
      userLocale,
      transcriptLanguage: actualLanguage,
      vectorStore,
      videoMetadata
    };
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

// Main execution
(async () => {
  try {
    // Load config and initialize
    const config = await loadConfig();
    const { language, userLocale, transcriptLanguage, vectorStore, videoMetadata } = await initialize(config);

    // Create agent
    const agent = await createAgent(vectorStore, videoMetadata, language, userLocale);

    // Generate summary (don't display it here - the new UI will show it)
    const summarySpinner = startSpinner(getMessage('summary_generating', userLocale));
    try {
      const summaryContent = await generateSummary(agent, videoMetadata, userLocale);
      summarySpinner.stop();
      summarySpinner.clear();

      // Add summary to conversation history
      conversationHistory.push({
        timestamp: new Date(),
        role: "assistant",
        content: summaryContent,
      });
    } catch (error) {
      summarySpinner.fail();
      displayError('error_generating_summary', userLocale, { error: error.message });
    }

    // Small delay to ensure spinner cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start chat session with new conversational UI (preserve all loading messages above)
    await startChat(agent, conversationHistory, videoMetadata, youtubeUrl, userLocale, language, transcriptLanguage);
  } catch (error) {
    displayError('error_general', currentLocale, { error: error.message });
    process.exit(1);
  }
})();