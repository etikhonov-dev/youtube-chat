import { getMessage, getLanguageEntries } from "../../localization.js";
import { loadConfig, saveConfig } from "../services/config.js";
import { exportToClipboard, exportToFile, getDefaultExportFilename } from "../services/export.js";
import { padEndVisual } from "../utils/formatting.js";
import { createSelectionPrompt, createTextPrompt } from "./input-handler.js";

// ANSI escape codes
const BOLD_CYAN = '\x1b[1;36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Handle export command with user prompts
 * @param {Array} conversationHistory - Array of conversation entries
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} youtubeUrl - YouTube video URL
 * @param {string} locale - Current locale
 * @returns {Promise<void>}
 */
export async function handleExportCommand(conversationHistory, videoMetadata, youtubeUrl, locale) {
  const options = [
    {
      label: 'Copy to clipboard',
      description: 'Quick access · Paste anywhere'
    },
    {
      label: 'Save to file',
      description: 'Permanent record · Customize filename'
    }
  ];

  const selectedIndex = await createSelectionPrompt(
    options,
    getMessage('export_header', locale),
    0 // Default to clipboard
  );

  // User cancelled with Esc
  if (selectedIndex === null) {
    console.log(`\n${DIM}Cancelled.${RESET}\n`);
    return;
  }

  // Give terminal time to complete menu cleanup before showing success message
  await new Promise(resolve => setTimeout(resolve, 100));

  // Execute selected option
  if (selectedIndex === 0) {
    await exportToClipboard(conversationHistory, videoMetadata, youtubeUrl, locale);
  } else if (selectedIndex === 1) {
    await promptForFileExport(conversationHistory, videoMetadata, youtubeUrl, locale);
  }
}

/**
 * Prompt user for file export
 * @param {Array} conversationHistory - Array of conversation entries
 * @param {Object} videoMetadata - Video metadata object
 * @param {string} youtubeUrl - YouTube video URL
 * @param {string} locale - Current locale
 * @returns {Promise<void>}
 */
async function promptForFileExport(conversationHistory, videoMetadata, youtubeUrl, locale) {
  const defaultFilename = getDefaultExportFilename();
  const prompt = `${BOLD_CYAN}Enter filename:${RESET}\n${DIM}Default: ${defaultFilename}${RESET}`;

  const filename = await createTextPrompt(
    prompt,
    defaultFilename,
    'Press Enter to use default • Type custom name • Esc to cancel'
  );

  // User cancelled with Esc
  if (filename === null) {
    return;
  }

  await exportToFile(conversationHistory, videoMetadata, youtubeUrl, filename, locale);
}

/**
 * Handle language selection command with user prompts
 * @param {Object} rl - Readline interface
 * @param {string} locale - Current locale
 * @returns {Promise<void>}
 */
export async function handleLangCommand(rl, locale) {
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
    const prompt = getMessage('lang_choice_prompt', locale, { max: langEntries.length + 1 }) + ' (or press Enter to cancel): ';
    rl.question(prompt, async (choice) => {
      const trimmedChoice = choice.trim();

      // Check for empty input (just Enter) - return to chat
      if (trimmedChoice === '') {
        console.log(`\n${DIM}Returning to chat...${RESET}\n`);
        resolve();
        return;
      }

      const selectedNum = parseInt(trimmedChoice, 10);

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