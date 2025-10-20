#!/usr/bin/env node

import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import readline from "readline";
import { Innertube } from "youtubei.js";
import clipboardy from "clipboardy";
import fs from "fs/promises";

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
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
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

// Initialize the system
async function initialize() {
  console.log("\n🔄 Loading YouTube video transcript...");

  // Load YouTube transcript with metadata
  const loader = YoutubeLoader.createFromUrl(youtubeUrl, {
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
    const videoId = extractVideoId(youtubeUrl);
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

  // Split the transcript into chunks
  console.log("\n🔄 Processing transcript...");
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const splits = await textSplitter.splitDocuments(docs);
  console.log(`✅ Created ${splits.length} chunks`);

  // Create embeddings and vector store
  console.log("\n🔄 Creating vector store with embeddings...");
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
  });

  vectorStore = await MemoryVectorStore.fromDocuments(splits, embeddings);
  console.log("✅ Vector store ready");
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
      const timestamp = formatTimestamp(doc.metadata.timestamp);
      return `[${timestamp}] ${doc.pageContent}`;
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

1. [Topic Name] [MM:SS - MM:SS]
2. [Topic Name] [MM:SS - MM:SS]
3. [Topic Name] [MM:SS - MM:SS]

Search the transcript thoroughly to identify 5-8 main topics with their timestamp ranges. Be specific about what each topic covers.`;

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