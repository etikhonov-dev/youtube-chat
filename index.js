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
import fs from "fs/promises";
import getUserLocale from "get-user-locale";
import os from "os";
import path from "path";

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

// Extract language override if provided (--lang=es or --locale=es-ES)
let languageOverride = null;
const filteredArgs = args.filter(arg => {
  if (arg.startsWith('--lang=') || arg.startsWith('--locale=')) {
    languageOverride = arg.split('=')[1];
    return false; // Remove from args
  }
  return true;
});

if (filteredArgs.length === 0) {
  console.log("Usage: node index.js <youtube-url> [--lang=<language>]");
  console.log("\nExamples:");
  console.log("  node index.js https://youtu.be/bZQun8Y4L2A");
  console.log("  node index.js https://youtu.be/bZQun8Y4L2A --lang=es");
  console.log("  node index.js https://youtu.be/bZQun8Y4L2A --locale=fr-FR");
  console.log("\nSupported languages: en, es, fr, de, it, pt, ru, ja, ko, zh, ar, hi, and more");
  process.exit(1);
}

const youtubeUrl = filteredArgs[0];

// Global variables to store video data
let vectorStore;
let videoMetadata = {};
let conversationHistory = [];

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
      // console.log("Captured video ID:", match[1]);
      return match[1];
    }
  }

  throw new Error("Invalid YouTube URL format");
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
async function saveConfig(config) {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`\n❌ Failed to save config: ${error.message}\n`);
    return false;
  }
}

// Available languages
const LANGUAGE_NAMES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'pl': 'Polish',
  'tr': 'Turkish',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'sv': 'Swedish',
  'da': 'Danish',
  'fi': 'Finnish',
  'no': 'Norwegian',
  'cs': 'Czech',
  'uk': 'Ukrainian',
};

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
      // Use 95th percentile as default
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

    // Default to percentile
    const sorted = [...distances].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  async splitText(text) {
    // Split into sentences
    const sentences = text.split(this.sentenceSplitRegex).filter(s => s.trim().length > 0);

    if (sentences.length <= 1) {
      return [text];
    }

    // Group sentences into buffers
    const groups = [];
    for (let i = 0; i < sentences.length; i += this.bufferSize) {
      const group = sentences.slice(i, i + this.bufferSize).join(" ");
      groups.push(group);
    }

    if (groups.length <= 1) {
      return [text];
    }

    // Get embeddings for each group
    const embeddings = await this.embeddings.embedDocuments(groups);

    // Calculate distances between consecutive embeddings
    const distances = [];
    for (let i = 0; i < embeddings.length - 1; i++) {
      const distance = this.cosineDistance(embeddings[i], embeddings[i + 1]);
      distances.push(distance);
    }

    if (distances.length === 0) {
      return [text];
    }

    // Calculate threshold
    const threshold = this.calculateBreakpointThreshold(distances);

    // Find breakpoints
    const breakpoints = [0];
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] > threshold) {
        breakpoints.push(i + 1);
      }
    }
    breakpoints.push(groups.length);

    // Create chunks based on breakpoints
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
async function initialize(localeOverride = null) {
  console.log("\n🔄 Loading YouTube video transcript...");

  // Extract video ID using our robust pattern (handles /live/, /shorts/, etc.)
  const videoId = extractVideoId(youtubeUrl);

  // Get user's locale and extract language code (e.g., "en-US" -> "en")
  // Use override if provided, otherwise detect from system
  let userLocale, language;

  if (localeOverride) {
    // Handle both "es" and "es-ES" formats
    if (localeOverride.includes('-')) {
      userLocale = localeOverride;
      language = localeOverride.split("-")[0];
    } else {
      language = localeOverride;
      userLocale = localeOverride; // Use language code as locale if no full locale provided
    }
    console.log(`🌐 Language override: ${language} (${userLocale})`);
  } else {
    userLocale = getUserLocale();
    language = userLocale ? userLocale.split("-")[0] : "en";
    console.log(`🌐 Detected locale: ${userLocale}`);
  }

  // Load YouTube transcript with metadata - using videoId directly
  // instead of createFromUrl to bypass LangChain's limited URL parser
  // Try requested language first, fallback to English if not available
  let docs;
  let actualLanguage = language;

  try {
    const loader = new YoutubeLoader({
      videoId: videoId,
      language: language,
      addVideoInfo: true,
    });
    docs = await loader.load();

    if (!docs || docs.length === 0) {
      throw new Error("No transcript found");
    }
  } catch (error) {
    // If requested language failed and it's not English, try English
    if (language !== 'en') {
      console.log(`⚠️  ${language.toUpperCase()} transcript not available, falling back to English`);
      try {
        const loaderEn = new YoutubeLoader({
          videoId: videoId,
          language: 'en',
          addVideoInfo: true,
        });
        docs = await loaderEn.load();
        actualLanguage = 'en';

        if (!docs || docs.length === 0) {
          throw new Error("No English transcript found either");
        }
      } catch (fallbackError) {
        throw new Error("Failed to load transcript. Video may not have captions available in any language.");
      }
    } else {
      throw new Error("Failed to load transcript. Video may not have captions available.");
    }
  }

  console.log(`📝 Transcript language: ${actualLanguage.toUpperCase()}`);

  // Fetch video duration using youtubei.js
  let duration = 0;
  try {
    const youtube = await Innertube.create();
    const info = await youtube.getInfo(videoId);
    duration = info.basic_info.duration || 0;
  } catch (error) {
    console.warn("⚠️  Could not fetch video duration:", error.message);
  }

  // Store video metadata
  videoMetadata = {
    title: docs[0].metadata.title || "Unknown",
    description: docs[0].metadata.description || "No description",
    author: docs[0].metadata.author || "Unknown",
    duration: duration,
  };

  console.log(`📹 Video: ${videoMetadata.title}`);
  console.log(`👤 Author: ${videoMetadata.author}`);
  console.log(`⏱️  Duration: ${formatTimestamp(videoMetadata.duration)}`);

  // Create embeddings model first (needed for semantic chunking)
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
  });

  // Split the transcript into semantic chunks
  const textSplitter = new SemanticChunker(embeddings, {
    breakpointThresholdType: "percentile",
  });

  const splits = await textSplitter.splitDocuments(docs);

  // Create vector store
  vectorStore = await MemoryVectorStore.fromDocuments(splits, embeddings);

  // Return language information for agent configuration
  return { language, userLocale };
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

    const formattedResults = results.map((doc) => {
      return doc.pageContent;
    }).join("\n\n");

    return formattedResults || "No relevant information found.";
  },
});

// Tool: Get video information
const getVideoInfoTool = new DynamicStructuredTool({
  name: "get_video_info",
  description: "Gets metadata about the video including title, author, description, and duration. Use this when the user asks about the video itself (who made it, how long it is, what it's about).",
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
    // temperature: 0,
    maxRetries: 2,
  });

  // Create tools array
  const tools = [searchTranscriptTool, getVideoInfoTool];

  // Create system prompt that instructs the AI to respond in user's language
  const languageNames = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
    'th': 'Thai',
    'sv': 'Swedish',
    'da': 'Danish',
    'fi': 'Finnish',
    'no': 'Norwegian',
    'cs': 'Czech',
    'uk': 'Ukrainian',
  };

  const languageName = languageNames[language] || language.toUpperCase();

  const systemPrompt = `You are a helpful assistant that answers questions about a YouTube video based on its transcript.

IMPORTANT: The user's locale is "${userLocale}" and they speak ${languageName}.
You MUST respond in ${languageName}.
Always provide your answers in ${languageName} to match the user's language preference.

When answering questions:
- Search the transcript to find relevant information
- Provide specific details and examples when possible
- If you can't find information in the transcript, say so
- Respond naturally and conversationally in ${languageName}`;

  // Create the agent graph with LangGraph
  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: systemPrompt,
  });

  return agent;
}

// Format conversation history for export
function formatConversationForExport() {
  const now = new Date();
  const dateStr = now.toLocaleString();

  let output = `YouTube Chat Conversation Export\n`;
  output += `${"=".repeat(60)}\n\n`;
  output += `Video: ${videoMetadata.title}\n`;
  output += `Author: ${videoMetadata.author}\n`;
  output += `URL: ${youtubeUrl}\n`;
  output += `Duration: ${formatTimestamp(videoMetadata.duration)}\n`;
  output += `Export Date: ${dateStr}\n\n`;
  output += `${"=".repeat(60)}\n\n`;

  if (conversationHistory.length === 0) {
    output += "No conversation history available.\n";
    return output;
  }

  for (const entry of conversationHistory) {
    const timeStr = entry.timestamp.toLocaleTimeString();
    const role = entry.role === "user" ? "You" : "Assistant";
    output += `[${timeStr}] ${role}: ${entry.content}\n\n`;
  }

  return output;
}

// Export conversation to clipboard
async function exportToClipboard() {
  try {
    const content = formatConversationForExport();
    await clipboardy.write(content);
    console.log("\n✅ Conversation copied to clipboard!\n");
  } catch (error) {
    console.error(`\n❌ Failed to copy to clipboard: ${error.message}\n`);
  }
}

// Export conversation to file
async function exportToFile(rl) {
  return new Promise((resolve) => {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-").split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const defaultFilename = `conversation-${dateStr}-${timeStr}.txt`;

    rl.question(`Enter filename (default: ${defaultFilename}): `, async (input) => {
      const filename = input.trim() || defaultFilename;

      try {
        const content = formatConversationForExport();
        await fs.writeFile(filename, content, "utf-8");
        console.log(`\n✅ Conversation saved to: ${filename}\n`);
      } catch (error) {
        console.error(`\n❌ Failed to save file: ${error.message}\n`);
      }

      resolve();
    });
  });
}

// Handle export command
async function handleExportCommand(rl) {
  console.log("\n" + "=".repeat(60));
  console.log("Export Conversation");
  console.log("=".repeat(60));
  console.log("\nSelect export method:\n");
  console.log("1. Copy to clipboard   Copy the conversation to your system clipboard");
  console.log("2. Save to file        Save the conversation to a file in the current directory\n");

  return new Promise((resolve) => {
    rl.question("Enter your choice (1 or 2): ", async (choice) => {
      const selectedChoice = choice.trim();

      if (selectedChoice === "1") {
        await exportToClipboard();
      } else if (selectedChoice === "2") {
        await exportToFile(rl);
      } else {
        console.log("\n❌ Invalid choice. Please enter 1 or 2.\n");
      }

      resolve();
    });
  });
}

// Handle language selection command
async function handleLangCommand(rl) {
  console.log("\n" + "=".repeat(60));
  console.log("Language Settings");
  console.log("=".repeat(60));

  // Load current config
  const config = await loadConfig();
  const currentLang = config.language || 'auto-detect';

  console.log(`\nCurrent language: ${currentLang}`);
  console.log("\nAvailable languages:\n");

  // Create array of language entries for numbering
  const langEntries = Object.entries(LANGUAGE_NAMES);

  // Display languages in two columns
  const halfLength = Math.ceil(langEntries.length / 2);
  for (let i = 0; i < halfLength; i++) {
    const [code1, name1] = langEntries[i];
    const num1 = String(i + 1).padStart(2, ' ');
    const col1 = `${num1}. ${code1.padEnd(3)} - ${name1.padEnd(20)}`;

    if (i + halfLength < langEntries.length) {
      const [code2, name2] = langEntries[i + halfLength];
      const num2 = String(i + halfLength + 1).padStart(2, ' ');
      const col2 = `${num2}. ${code2.padEnd(3)} - ${name2}`;
      console.log(`${col1}  ${col2}`);
    } else {
      console.log(col1);
    }
  }

  console.log(`\n ${String(langEntries.length + 1).padStart(2, ' ')}. Auto-detect (use system locale)\n`);

  return new Promise((resolve) => {
    rl.question(`Enter your choice (1-${langEntries.length + 1}): `, async (choice) => {
      const selectedNum = parseInt(choice.trim(), 10);

      if (isNaN(selectedNum) || selectedNum < 1 || selectedNum > langEntries.length + 1) {
        console.log(`\n❌ Invalid choice. Please enter a number between 1 and ${langEntries.length + 1}.\n`);
        resolve();
        return;
      }

      let newLanguage, newLocale;

      if (selectedNum === langEntries.length + 1) {
        // Auto-detect
        newLanguage = null;
        newLocale = null;
        console.log("\n✅ Language set to auto-detect (system locale)");
      } else {
        // Selected language
        const [code, name] = langEntries[selectedNum - 1];
        newLanguage = code;
        newLocale = code;
        console.log(`\n✅ Language set to: ${name} (${code})`);
      }

      // Save to config
      const success = await saveConfig({ language: newLanguage, locale: newLocale });

      if (success) {
        console.log("💾 Settings saved to ~/.youtube-chat-config.json");
        console.log("ℹ️  Changes will take effect when you load the next video\n");
      }

      resolve();
    });
  });
}

// Generate timestamped summary of main topics
async function generateSummary(agent) {
  console.log("\n🔄 Generating summary...\n");

  const summaryPrompt = `Based on the video "${videoMetadata.title}", what are the main topics covered?

Please format your response EXACTLY like this:

What are the main topics covered?

Based on the video "${videoMetadata.title}", the main topics are:

1. [Topic Name]
2. [Topic Name]
3. [Topic Name]

Search the transcript thoroughly to identify 5-8 main topics. Be specific about what each topic covers.`;

  try {
    const response = await agent.invoke({
      messages: [{ role: "user", content: summaryPrompt }],
    });

    const messages = response.messages;
    const lastMessage = messages[messages.length - 1];

    console.log(lastMessage.content);
    console.log("\n" + "=".repeat(60));

    // Store the summary in conversation history so it's included in exports
    conversationHistory.push({
      timestamp: new Date(),
      role: "assistant",
      content: lastMessage.content,
    });
  } catch (error) {
    console.error(`\n❌ Error generating summary: ${error.message}\n`);
  }
}

// Start the interactive chat session
async function startChat(agent) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n" + "=".repeat(60));
  console.log("💬 Chat started! Ask questions about the video.");
  console.log("Type 'exit', 'quit', or press Ctrl+C to end the session.");
  console.log("Type '/export' to export the conversation.");
  console.log("Type '/lang' to change language settings.");
  console.log("=".repeat(60) + "\n");

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      const userInput = input.trim();

      if (!userInput) {
        askQuestion();
        return;
      }

      if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
        console.log("\n👋 Goodbye!");
        rl.close();
        process.exit(0);
        return;
      }

      // Handle /export command
      if (userInput.toLowerCase() === "/export") {
        await handleExportCommand(rl);
        askQuestion();
        return;
      }

      // Handle /lang command
      if (userInput.toLowerCase() === "/lang") {
        await handleLangCommand(rl);
        askQuestion();
        return;
      }

      try {
        // Store user message in history
        conversationHistory.push({
          timestamp: new Date(),
          role: "user",
          content: userInput,
        });

        console.log("\n🤔 Thinking...\n");

        const response = await agent.invoke({
          messages: [{ role: "user", content: userInput }],
        });

        // Extract the final message from the agent's response
        const messages = response.messages;
        const lastMessage = messages[messages.length - 1];

        // Store assistant response in history with full message chain
        conversationHistory.push({
          timestamp: new Date(),
          role: "assistant",
          content: lastMessage.content,
          fullMessages: messages, // Store all messages including tool calls and reasoning
        });

        console.log(`Assistant: ${lastMessage.content}\n`);
      } catch (error) {
        console.error(`\n❌ Error: ${error.message}\n`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

// Main execution
(async () => {
  try {
    // Language priority: 1. CLI flag, 2. Config file, 3. System locale
    let effectiveLanguageOverride = languageOverride;

    if (!effectiveLanguageOverride) {
      // No CLI flag, check config file
      const config = await loadConfig();
      if (config.language) {
        effectiveLanguageOverride = config.language;
        console.log(`📄 Using saved language preference: ${config.language}`);
      }
    }

    const { language, userLocale } = await initialize(effectiveLanguageOverride);
    const agent = await createAgent(language, userLocale);
    await generateSummary(agent);
    await startChat(agent);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
})();