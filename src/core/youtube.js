import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { Innertube } from "youtubei.js";
import { getMessage } from "../../localization.js";

/**
 * Load YouTube transcript for a video
 * @param {string} videoId - YouTube video ID
 * @param {string} language - Preferred language code
 * @param {boolean} preferEnglish - Whether to prefer accurate English transcript
 * @param {string} locale - Current locale for messages
 * @returns {Promise<Object>} Object containing docs and actual language used
 */
export async function loadYouTubeTranscript(videoId, language, preferEnglish, locale) {
  let docs;
  let actualLanguage = language;

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
    // Try fallback to English if original language failed
    if (transcriptLanguage !== 'en') {
      try {
        const loaderEn = new YoutubeLoader({
          videoId: videoId,
          language: 'en',
          addVideoInfo: true,
        });
        docs = await loaderEn.load();
        actualLanguage = 'en';

        if (!docs || docs.length === 0) {
          throw new Error(getMessage('error_no_transcript_any', locale));
        }
      } catch (fallbackError) {
        throw new Error(getMessage('error_no_transcript_any', locale));
      }
    } else {
      throw new Error(getMessage('error_no_transcript', locale));
    }
  }

  return { docs, actualLanguage };
}

/**
 * Fetch video duration from YouTube
 * @param {string} videoId - YouTube video ID
 * @param {string} locale - Current locale for warnings
 * @returns {Promise<number>} Duration in seconds
 */
export async function fetchVideoDuration(videoId, locale) {
  try {
    const youtube = await Innertube.create();
    const info = await youtube.getInfo(videoId);
    return info.basic_info.duration || 0;
  } catch (error) {
    console.warn(getMessage('video_duration_warning', locale, { error: error.message }));
    return 0;
  }
}

/**
 * Extract video metadata from loaded documents
 * @param {Array} docs - Loaded documents from YouTube
 * @param {number} duration - Video duration in seconds
 * @returns {Object} Video metadata object
 */
export function extractVideoMetadata(docs, duration) {
  return {
    title: docs[0].metadata.title || "Unknown",
    description: docs[0].metadata.description || "No description",
    author: docs[0].metadata.author || "Unknown",
    duration: duration,
  };
}