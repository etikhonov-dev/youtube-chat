import fs from "fs/promises";
import os from "os";
import path from "path";
import { getMessage } from "../../localization.js";

// Config file path
const CONFIG_PATH = path.join(os.homedir(), '.youtube-chat-config.json');

/**
 * Load configuration from file
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Return default config if file doesn't exist or can't be read
    return { language: null, locale: null };
  }
}

/**
 * Save configuration to file
 * @param {Object} config - Configuration object to save
 * @param {string} locale - Current locale for error messages
 * @returns {Promise<boolean>} Success status
 */
export async function saveConfig(config, locale) {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`\n${getMessage('error_save_config', locale, { error: error.message })}\n`);
    return false;
  }
}