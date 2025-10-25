import fs from "fs/promises";
import clipboardy from "clipboardy";
import { getMessage } from "../../localization.js";
import { formatTimestamp } from "../utils/formatting.js";

/**
 * Format conversation history for export
 * @param {Array} conversationHistory - Array of conversation entries
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} youtubeUrl - YouTube video URL
 * @param {string} locale - Current locale
 * @returns {string} Formatted conversation text
 */
export function formatConversationForExport(conversationHistory, videoMetadata, youtubeUrl, locale) {
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

/**
 * Export conversation to clipboard
 * @param {Array} conversationHistory - Array of conversation entries
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} youtubeUrl - YouTube video URL
 * @param {string} locale - Current locale
 * @returns {Promise<void>}
 */
export async function exportToClipboard(conversationHistory, videoMetadata, youtubeUrl, locale) {
  try {
    const content = formatConversationForExport(conversationHistory, videoMetadata, youtubeUrl, locale);
    await clipboardy.write(content);
    console.log(`\n${getMessage('export_clipboard_success', locale)}\n`);
  } catch (error) {
    console.error(`\n${getMessage('error_clipboard_copy', locale, { error: error.message })}\n`);
  }
}

/**
 * Export conversation to file
 * @param {Array} conversationHistory - Array of conversation entries
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} youtubeUrl - YouTube video URL
 * @param {string} filename - File name to save to
 * @param {string} locale - Current locale
 * @returns {Promise<void>}
 */
export async function exportToFile(conversationHistory, videoMetadata, youtubeUrl, filename, locale) {
  try {
    const content = formatConversationForExport(conversationHistory, videoMetadata, youtubeUrl, locale);
    await fs.writeFile(filename, content, "utf-8");
    console.log(`\n${getMessage('export_file_success', locale, { filename })}\n`);
  } catch (error) {
    console.error(`\n${getMessage('error_file_save', locale, { error: error.message })}\n`);
  }
}

/**
 * Get default filename for export
 * @returns {string} Default filename with timestamp
 */
export function getDefaultExportFilename() {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-").split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  return `conversation-${dateStr}-${timeStr}.txt`;
}