#!/usr/bin/env node

import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { Document } from "@langchain/core/documents";
import readline from "readline";
import { Innertube } from "youtubei.js";
import clipboardy from "clipboardy";
import stringWidth from "string-width";
import fs from "fs/promises";
import os from "os";
import path from "path";
import ora from "ora";
import cliMarkdown from "cli-markdown";
import { getMessage, getLanguageName, detectLocale, getLanguageEntries } from "./localization.js";

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

  console.log(getMessage('usage_header', locale));
  console.log(getMessage('usage_examples', locale));
  console.log(getMessage('usage_example_1', locale));
  console.log(getMessage('usage_note', locale));
  process.exit(1);
}

const youtubeUrl = args[0];

// Global variables to store video data and user locale
let vectorStore;
let videoMetadata = {};
let conversationHistory = [];
let currentLocale = 'en'; // Will be set during initialization

// Extract video ID from YouTube URL
function extractVideoId(url) {
  url = url.trim();

  const patterns = [
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)(?:.*[?&]v=|\/embed\/|\/v\/|\/e\/|\/shorts\/|\/live\/|\/attribution_link?.*v=|\/oembed\?url=.*v=|\/)?([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new Error(getMessage('error_invalid_url', currentLocale));
}

// Format timestamp from seconds to MM:SS or HH:MM:SS
function formatTimestamp(seconds) {
  if (!seconds) return "00:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Render markdown to terminal
function renderMarkdown(text) {
  try {
    return cliMarkdown(text);
  } catch (error) {
    // If markdown parsing fails, return original text
    return text;
  }
}

// Helper function to pad strings accounting for visual width (handles wide characters)
function padEndVisual(str, targetWidth, padChar = ' ') {
  const currentWidth = stringWidth(str);
  if (currentWidth >= targetWidth) {
    return str;
  }
  const paddingNeeded = targetWidth - currentWidth;
  return str + padChar.repeat(paddingNeeded);
}

// Config file path
const CONFIG_PATH = path.join(os.homedir(), '.youtube-chat-config.json');

// Load config from file
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Return default config if file doesn't exist or can't be read
    return { language: null, locale: null };
  }
}

// Save config to file
async function saveConfig(config, locale) {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`\n${getMessage('error_save_config', locale, { error: error.message })}\n`);
    return false;
  }
}

// SemanticChunker - splits text based on semantic similarity
class SemanticChunker {
  constructor(embeddings, options = {}) {
    this.embeddings = embeddings;
    this.bufferSize = options.bufferSize || 1;
    this.breakpointThresholdType = options.breakpointThresholdType || "percentile";
    this.breakpointThresholdAmount = options.breakpointThresholdAmount;
    this.sentenceSplitRegex = options.sentenceSplitRegex || /(?<=[.?!])\s+/;
  }

  // Calculate cosine distance between two vectors
  cosineDistance(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return 1 - dotProduct / (magnitudeA * magnitudeB);
  }

  // Calculate breakpoint threshold based on distances
  calculateBreakpointThreshold(distances) {
    if (this.breakpointThresholdAmount !== undefined) {
      return this.breakpointThresholdAmount;
    }

    if (this.breakpointThresholdType === "percentile") {
      const sorted = [...distances].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.95);
      return sorted[index];
    } else if (this.breakpointThresholdType === "standard_deviation") {
      const mean = distances.reduce((sum, val) => sum + val, 0) / distances.length;
      const variance = distances.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / distances.length;
      const stdDev = Math.sqrt(variance);
      return mean + stdDev;
    } else if (this.breakpointThresholdType === "interquartile") {
      const sorted = [...distances].sort((a, b) => a - b);
      const q1Index = Math.floor(sorted.length * 0.25);
      const q3Index = Math.floor(sorted.length * 0.75);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      return q3 + 1.5 * iqr;
    }

    const sorted = [...distances].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  async splitText(text) {
    const sentences = text.split(this.sentenceSplitRegex).filter(s => s.trim().length > 0);

    if (sentences.length <= 1) {
      return [text];
    }

    const groups = [];
    for (let i = 0; i < sentences.length; i += this.bufferSize) {
      const group = sentences.slice(i, i + this.bufferSize).join(" ");
      groups.push(group);
    }

    if (groups.length <= 1) {
      return [text];
    }

    const embeddings = await this.embeddings.embedDocuments(groups);

    const distances = [];
    for (let i = 0; i < embeddings.length - 1; i++) {
      const distance = this.cosineDistance(embeddings[i], embeddings[i + 1]);
      distances.push(distance);
    }

    if (distances.length === 0) {
      return [text];
    }

    const threshold = this.calculateBreakpointThreshold(distances);

    const breakpoints = [0];
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] > threshold) {
        breakpoints.push(i + 1);
      }
    }
    breakpoints.push(groups.length);

    const chunks = [];
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const start = breakpoints[i];
      const end = breakpoints[i + 1];
      const chunk = groups.slice(start, end).join(" ");
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks.length > 0 ? chunks : [text];
  }

  async splitDocuments(documents) {
    const splitDocs = [];

    for (const doc of documents) {
      const chunks = await this.splitText(doc.pageContent);

      for (const chunk of chunks) {
        splitDocs.push(
          new Document({
            pageContent: chunk,
            metadata: { ...doc.metadata }
          })
        );
      }
    }

    return splitDocs;
  }
}

// Initialize the system
async function initialize(config) {
  // Detect locale from config or system
  const { language, locale: userLocale } = detectLocale(config);
  currentLocale = userLocale; // Set global locale for error messages

  console.log('');

  const spinner = ora({
    text: getMessage('loading_transcript', userLocale),
    spinner: 'dots'
  }).start();

  try {
    // Extract video ID using our robust pattern
    const videoId = extractVideoId(youtubeUrl);

    // Load YouTube transcript
    let docs;
    let actualLanguage = language;

    // Check if user prefers accurate English transcript
    const preferEnglish = config.preferAccurateTranscript === true;
    const transcriptLanguage = preferEnglish ? 'en' : language;

    try {
      const loader = new YoutubeLoader({
        videoId: videoId,
        language: transcriptLanguage,
        addVideoInfo: true,
      });
      docs = await loader.load();
      actualLanguage = transcriptLanguage;

      if (!docs || docs.length === 0) {
        throw new Error("No transcript found");
      }
    } catch (error) {
      if (transcriptLanguage !== 'en') {
        spinner.text = getMessage('transcript_fallback', userLocale, { language: transcriptLanguage.toUpperCase() });
        try {
          const loaderEn = new YoutubeLoader({
            videoId: videoId,
            language: 'en',
            addVideoInfo: true,
          });
          docs = await loaderEn.load();
          actualLanguage = 'en';

          if (!docs || docs.length === 0) {
            throw new Error(getMessage('error_no_transcript_any', userLocale));
          }
        } catch (fallbackError) {
          throw new Error(getMessage('error_no_transcript_any', userLocale));
        }
      } else {
        throw new Error(getMessage('error_no_transcript', userLocale));
      }
    }

    // Fetch video duration
    let duration = 0;
    try {
      const youtube = await Innertube.create();
      const info = await youtube.getInfo(videoId);
      duration = info.basic_info.duration || 0;
    } catch (error) {
      console.warn(getMessage('video_duration_warning', userLocale, { error: error.message }));
    }

    // Store video metadata
    videoMetadata = {
      title: docs[0].metadata.title || "Unknown",
      description: docs[0].metadata.description || "No description",
      author: docs[0].metadata.author || "Unknown",
      duration: duration,
    };

    spinner.stop();
    spinner.clear();

    console.log(getMessage('video_info_title', userLocale, { title: videoMetadata.title }));
    console.log(getMessage('video_info_author', userLocale, { author: videoMetadata.author }));
    console.log(getMessage('video_info_duration', userLocale, { duration: formatTimestamp(videoMetadata.duration) }));
    console.log('');

    // Create embeddings and vector store
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
    });

    const textSplitter = new SemanticChunker(embeddings, {
      breakpointThresholdType: "interquartile",
    });

    const splits = await textSplitter.splitDocuments(docs);
    vectorStore = await MemoryVectorStore.fromDocuments(splits, embeddings);

    return { language, userLocale, transcriptLanguage: actualLanguage };
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

// Tool: Search the video transcript
const searchTranscriptTool = new DynamicStructuredTool({
  name: "search_transcript",
  description: "Searches the video transcript for relevant information. Use this when you need to find specific content, topics, or answer questions about what was said in the video. Returns relevant sections with timestamps.",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query or topic to look for in the transcript",
      },
      numResults: {
        type: "number",
        description: "Number of relevant sections to return (default: 4)",
        default: 4,
      },
    },
    required: ["query"],
  },
  func: async ({ query, numResults = 4 }) => {
    const results = await vectorStore.similaritySearch(query, numResults);
    const formattedResults = results.map((doc) => doc.pageContent).join("\n\n");
    return formattedResults || "No relevant information found.";
  },
});

// Tool: Get video information
const getVideoInfoTool = new DynamicStructuredTool({
  name: "get_video_info",
  description: "Gets metadata about the video including title, author, description, and duration.",
  schema: {
    type: "object",
    properties: {},
    required: [],
  },
  func: async () => {
    return `Title: ${videoMetadata.title}
Author: ${videoMetadata.author}
Duration: ${formatTimestamp(videoMetadata.duration)}
Description: ${videoMetadata.description}`;
  },
});

// Create the conversational agent
async function createAgent(language, userLocale) {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash-001",
    maxRetries: 3,
  });

  const tools = [searchTranscriptTool, getVideoInfoTool];

  // Build system prompt using localization
  const languageName = getLanguageName(language);
  const systemPrompt = getMessage('system_prompt_intro', userLocale) +
                      getMessage('system_prompt_language', userLocale, { locale: userLocale, languageName }) +
                      getMessage('system_prompt_instructions', userLocale, { languageName });

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: systemPrompt,
  });

  return agent;
}

// Format conversation history for export
function formatConversationForExport(locale) {
  const now = new Date();
  const dateStr = now.toLocaleString();

  let output = `${getMessage('export_title', locale)}\n`;
  output += `${"=".repeat(60)}\n\n`;
  output += `Video: ${videoMetadata.title}\n`;
  output += `Author: ${videoMetadata.author}\n`;
  output += `URL: ${youtubeUrl}\n`;
  output += `Duration: ${formatTimestamp(videoMetadata.duration)}\n`;
  output += `Export Date: ${dateStr}\n\n`;
  output += `${"=".repeat(60)}\n\n`;

  if (conversationHistory.length === 0) {
    output += getMessage('export_no_history', locale) + "\n";
    return output;
  }

  for (const entry of conversationHistory) {
    const timeStr = entry.timestamp.toLocaleTimeString();
    const role = entry.role === "user" ? getMessage('role_you', locale) : getMessage('role_assistant', locale);
    output += `[${timeStr}] ${role}: ${entry.content}\n\n`;
  }

  return output;
}

// Export conversation to clipboard
async function exportToClipboard(locale) {
  try {
    const content = formatConversationForExport(locale);
    await clipboardy.write(content);
    console.log(`\n${getMessage('export_clipboard_success', locale)}\n`);
  } catch (error) {
    console.error(`\n${getMessage('error_clipboard_copy', locale, { error: error.message })}\n`);
  }
}

// Export conversation to file
async function exportToFile(rl, locale) {
  return new Promise((resolve) => {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-").split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const defaultFilename = `conversation-${dateStr}-${timeStr}.txt`;

    const prompt = getMessage('export_file_prompt', locale, { filename: defaultFilename });
    rl.question(prompt, async (input) => {
      const filename = input.trim() || defaultFilename;

      try {
        const content = formatConversationForExport(locale);
        await fs.writeFile(filename, content, "utf-8");
        console.log(`\n${getMessage('export_file_success', locale, { filename })}\n`);
      } catch (error) {
        console.error(`\n${getMessage('error_file_save', locale, { error: error.message })}\n`);
      }

      resolve();
    });
  });
}

// Handle export command
async function handleExportCommand(rl, locale) {
  console.log("\n" + "=".repeat(60));
  console.log(getMessage('export_header', locale));
  console.log("=".repeat(60));
  console.log(getMessage('export_select_method', locale));
  console.log(getMessage('export_option_clipboard', locale));
  console.log(getMessage('export_option_file', locale));

  return new Promise((resolve) => {
    rl.question(getMessage('export_choice_prompt', locale), async (choice) => {
      const selectedChoice = choice.trim();

      if (selectedChoice === "1") {
        await exportToClipboard(locale);
      } else if (selectedChoice === "2") {
        await exportToFile(rl, locale);
      } else {
        console.log(`\n${getMessage('export_invalid_choice', locale)}\n`);
      }

      resolve();
    });
  });
}

// Handle language selection command
async function handleLangCommand(rl, locale) {
  console.log("\n" + "=".repeat(60));
  console.log(getMessage('lang_header', locale));
  console.log("=".repeat(60));

  const config = await loadConfig();
  const currentLang = config.language || 'auto-detect';
  const transcriptPref = config.preferAccurateTranscript ?
    getMessage('lang_prefer_accurate', locale) :
    getMessage('lang_prefer_native', locale);

  console.log(getMessage('lang_current', locale, { language: currentLang }));
  console.log(getMessage('lang_transcript_preference', locale, { preference: transcriptPref }));
  console.log(getMessage('lang_available', locale));

  const langEntries = getLanguageEntries();

  // Display languages in two columns
  const halfLength = Math.ceil(langEntries.length / 2);
  for (let i = 0; i < halfLength; i++) {
    const [code1, name1] = langEntries[i];
    const num1 = String(i + 1).padStart(2, ' ');
    const col1 = `${num1}. ${code1.padEnd(3)} - ${padEndVisual(name1, 20)}`;

    if (i + halfLength < langEntries.length) {
      const [code2, name2] = langEntries[i + halfLength];
      const num2 = String(i + halfLength + 1).padStart(2, ' ');
      const col2 = `${num2}. ${code2.padEnd(3)} - ${name2}`;
      console.log(`${col1}  ${col2}`);
    } else {
      console.log(col1);
    }
  }

  const autoDetectOption = `\n ${String(langEntries.length + 1).padStart(2, ' ')}. ${getMessage('lang_auto_detect', locale)}\n`;
  console.log(autoDetectOption);

  return new Promise((resolve) => {
    const prompt = getMessage('lang_choice_prompt', locale, { max: langEntries.length + 1 });
    rl.question(prompt, async (choice) => {
      const selectedNum = parseInt(choice.trim(), 10);

      if (isNaN(selectedNum) || selectedNum < 1 || selectedNum > langEntries.length + 1) {
        console.log(`\n${getMessage('lang_invalid_choice', locale, { max: langEntries.length + 1 })}\n`);
        resolve();
        return;
      }

      let newLanguage, newLocale;

      if (selectedNum === langEntries.length + 1) {
        newLanguage = null;
        newLocale = null;
        console.log(`\n${getMessage('lang_set_auto', locale)}`);
      } else {
        const [code, name] = langEntries[selectedNum - 1];
        newLanguage = code;
        newLocale = code;
        console.log(`\n${getMessage('lang_set_to', locale, { name, code })}`);
      }

      // Ask about transcript preference
      console.log(getMessage('lang_transcript_toggle_prompt', locale));
      rl.question('', async (transcriptChoice) => {
        const choice = transcriptChoice.trim();
        let preferAccurateTranscript = config.preferAccurateTranscript || false;

        if (choice === '1') {
          preferAccurateTranscript = false;
          console.log(`\n${getMessage('lang_transcript_set_native', locale)}`);
        } else if (choice === '2') {
          preferAccurateTranscript = true;
          console.log(`\n${getMessage('lang_transcript_set_english', locale)}`);
        }
        // If empty/Enter pressed, keep current setting

        const newConfig = {
          language: newLanguage,
          locale: newLocale,
          preferAccurateTranscript
        };

        const success = await saveConfig(newConfig, locale);

        if (success) {
          console.log(getMessage('lang_saved', locale));
          console.log(getMessage('lang_effect_notice', locale) + '\n');
          rl.close();
          process.exit(0);
        }

        resolve();
      });
    });
  });
}

// Generate summary of main topics
async function generateSummary(agent, locale) {
  const summarySpinner = ora({
    text: getMessage('summary_generating', locale),
    spinner: 'dots'
  }).start();

  const summaryIntro = getMessage('summary_intro', locale, { title: videoMetadata.title });

  const summaryPrompt = `Based on the video "${videoMetadata.title}", what are the main topics covered?

IMPORTANT: Start your response IMMEDIATELY with "${summaryIntro}" followed by a numbered list. Do NOT include any other text before or after. Do NOT explain what you're doing. Be direct and user-centric.

Format:
${summaryIntro}

1. **Topic Name**: Brief description
2. **Topic Name**: Brief description
3. **Topic Name**: Brief description

Search the transcript thoroughly to identify 5-8 main topics.`;

  try {
    const response = await agent.invoke({
      messages: [{ role: "user", content: summaryPrompt }],
    });

    const messages = response.messages;
    const lastMessage = messages[messages.length - 1];

    summarySpinner.stop();
    summarySpinner.clear();
    console.log(renderMarkdown(lastMessage.content));
    console.log("\n" + "=".repeat(60));

    conversationHistory.push({
      timestamp: new Date(),
      role: "assistant",
      content: lastMessage.content,
    });
  } catch (error) {
    summarySpinner.fail();
    console.error(`\n${getMessage('error_generating_summary', locale, { error: error.message })}\n`);
  }
}

// Start the interactive chat session
async function startChat(agent, locale, uiLanguage, transcriptLanguage) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n" + "=".repeat(60));
  console.log(getMessage('chat_started_with_languages', locale, {
    uiLanguage: getLanguageName(uiLanguage),
    transcriptLanguage: getLanguageName(transcriptLanguage)
  }));
  console.log(getMessage('chat_exit_instruction', locale));
  console.log(getMessage('chat_export_instruction', locale));
  console.log(getMessage('chat_lang_instruction', locale));
  console.log("=".repeat(60) + "\n");

  const askQuestion = () => {
    rl.question(`${getMessage('role_you', locale)}: `, async (input) => {
      const userInput = input.trim();

      if (!userInput) {
        askQuestion();
        return;
      }

      if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
        console.log(`\n${getMessage('chat_goodbye', locale)}`);
        rl.close();
        process.exit(0);
      }

      if (userInput.toLowerCase() === "/export") {
        await handleExportCommand(rl, locale);
        askQuestion();
        return;
      }

      if (userInput.toLowerCase() === "/lang") {
        await handleLangCommand(rl, locale);
        askQuestion();
        return;
      }

      try {
        conversationHistory.push({
          timestamp: new Date(),
          role: "user",
          content: userInput,
        });

        const thinkingSpinner = ora({
          text: getMessage('chat_thinking', locale),
          spinner: 'dots',
          discardStdin: false
        }).start();

        const response = await agent.invoke({
          messages: [{ role: "user", content: userInput }],
        });

        const messages = response.messages;
        const lastMessage = messages[messages.length - 1];

        conversationHistory.push({
          timestamp: new Date(),
          role: "assistant",
          content: lastMessage.content,
          fullMessages: messages,
        });

        thinkingSpinner.stop();
        console.log(`${getMessage('role_assistant', locale)}: ${renderMarkdown(lastMessage.content)}\n`);
      } catch (error) {
        console.error(`\n${getMessage('error_general', locale, { error: error.message })}\n`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

// Main execution
(async () => {
  try {
    // Load config and detect locale
    const config = await loadConfig();

    const { language, userLocale, transcriptLanguage } = await initialize(config);
    const agent = await createAgent(language, userLocale);
    await generateSummary(agent, userLocale);
    await startChat(agent, userLocale, language, transcriptLanguage);
  } catch (error) {
    console.error(`\n${getMessage('error_general', currentLocale, { error: error.message })}`);
    process.exit(1);
  }
})();