import stringWidth from "string-width";
import { getMessage } from "../../localization.js";

/**
 * Extract video ID from YouTube URL
 * @param {string} url - YouTube URL or video ID
 * @param {string} locale - Current locale for error messages
 * @returns {string} Video ID
 */
export function extractVideoId(url, locale = 'en') {
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

  throw new Error(getMessage('error_invalid_url', locale));
}

/**
 * Format timestamp from seconds to MM:SS or HH:MM:SS
 * @param {number} seconds - Timestamp in seconds
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(seconds) {
  if (!seconds) return "00:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper function to pad strings accounting for visual width (handles wide characters)
 * @param {string} str - String to pad
 * @param {number} targetWidth - Target width
 * @param {string} padChar - Padding character
 * @returns {string} Padded string
 */
export function padEndVisual(str, targetWidth, padChar = ' ') {
  const currentWidth = stringWidth(str);
  if (currentWidth >= targetWidth) {
    return str;
  }
  const paddingNeeded = targetWidth - currentWidth;
  return str + padChar.repeat(paddingNeeded);
}