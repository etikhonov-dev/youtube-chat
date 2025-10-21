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
  console.log("Usage: node index.js <youtube-url>");
  console.log("Example: node index.js https://youtu.be/bZQun8Y4L2A");
  process.exit(1);
}

const youtubeUrl = args[0];

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
async function initialize() {
  console.log("\n🔄 Loading YouTube video transcript...");

  // Extract video ID using our robust pattern (handles /live/, /shorts/, etc.)
  const videoId = extractVideoId(youtubeUrl);

  // Load YouTube transcript with metadata - using videoId directly
  // instead of createFromUrl to bypass LangChain's limited URL parser
  const loader = new YoutubeLoader({
    videoId: videoId,
    language: "en",
    addVideoInfo: true,
  });

  const docs = await loader.load();

  if (!docs || docs.length === 0) {
    throw new Error("Failed to load transcript. Video may not have captions available.");
  }

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
async function createAgent() {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash-001",
    // temperature: 0,
    maxRetries: 2,
  });

  // Create tools array
  const tools = [searchTranscriptTool, getVideoInfoTool];

  // Create the agent graph with LangGraph
  const agent = createReactAgent({
    llm,
    tools,
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

        // Store assistant response in history
        conversationHistory.push({
          timestamp: new Date(),
          role: "assistant",
          content: lastMessage.content,
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
    await initialize();
    const agent = await createAgent();
    await generateSummary(agent);
    await startChat(agent);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
})();