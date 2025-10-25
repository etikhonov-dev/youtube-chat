import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMessage, getLanguageName } from "../../localization.js";
import { formatTimestamp } from "../utils/formatting.js";

/**
 * Create tool for searching video transcript
 * @param {MemoryVectorStore} vectorStore - Vector store instance
 * @returns {DynamicStructuredTool} Search transcript tool
 */
export function createSearchTranscriptTool(vectorStore) {
  return new DynamicStructuredTool({
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
}

/**
 * Create tool for getting video information
 * @param {Object} videoMetadata - Video metadata object
 * @returns {DynamicStructuredTool} Get video info tool
 */
export function createGetVideoInfoTool(videoMetadata) {
  return new DynamicStructuredTool({
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
}

/**
 * Create the conversational agent
 * @param {MemoryVectorStore} vectorStore - Vector store instance
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} language - Language code for responses
 * @param {string} userLocale - User's locale
 * @returns {Promise<Agent>} Configured agent instance
 */
export async function createAgent(vectorStore, videoMetadata, language, userLocale) {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash-001",
    maxRetries: 3,
  });

  const tools = [
    createSearchTranscriptTool(vectorStore),
    createGetVideoInfoTool(videoMetadata)
  ];

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

/**
 * Generate summary of main topics
 * @param {Agent} agent - Agent instance
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} locale - Current locale
 * @returns {Promise<string>} Summary content
 */
export async function generateSummary(agent, videoMetadata, locale) {
  const summaryIntro = getMessage('summary_intro', locale, { title: videoMetadata.title });

  const summaryPrompt = `Based on the video "${videoMetadata.title}", what are the main topics covered?

IMPORTANT: Start your response IMMEDIATELY with "${summaryIntro}" followed by a numbered list. Do NOT include any other text before or after. Do NOT explain what you're doing. Be direct and user-centric.

Format:
${summaryIntro}

1. **Topic Name**: Brief description
2. **Topic Name**: Brief description
3. **Topic Name**: Brief description

Search the transcript thoroughly to identify 5-8 main topics.`;

  const response = await agent.invoke({
    messages: [{ role: "user", content: summaryPrompt }],
  });

  const messages = response.messages;
  const lastMessage = messages[messages.length - 1];

  return lastMessage.content;
}