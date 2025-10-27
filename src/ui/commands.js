/**
 * Command registry with metadata
 */

// ANSI escape codes
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Available commands
 * @type {Array<{name: string, description: string, aliases: Array<string>}>}
 */
export const COMMANDS = [
  {
    name: '/summarize',
    description: 'Generate video summary',
    aliases: [],
  },
  {
    name: '/export',
    description: 'Export conversation to file or clipboard',
    aliases: [],
  },
  {
    name: '/lang',
    description: 'Change UI and transcript language',
    aliases: [],
  },
  {
    name: '/model',
    description: 'Select AI model (OpenRouter)',
    aliases: [],
  },
  {
    name: '/quit',
    description: 'Exit application (Ctrl+C)',
    aliases: ['/exit'], // backward compatibility
  },
];

/**
 * Get command by name or alias
 * @param {string} input - Command input
 * @returns {Object|null} Command object or null
 */
export function getCommand(input) {
  const normalized = input.toLowerCase().trim();
  return COMMANDS.find(cmd =>
    cmd.name === normalized || cmd.aliases.includes(normalized)
  ) || null;
}

/**
 * Get all command names (including aliases) for tab completion
 * @returns {Array<string>} Array of command names
 */
export function getAllCommandNames() {
  const names = [];
  for (const cmd of COMMANDS) {
    names.push(cmd.name);
    names.push(...cmd.aliases);
  }
  return names;
}

/**
 * Format command for display in dropdown
 * @param {Object} cmd - Command object
 * @returns {string} Formatted display string
 */
export function formatCommand(cmd) {
  // Pad name to align descriptions (10 chars for command name)
  const namePadded = cmd.name.padEnd(10);
  return `${CYAN}${namePadded}${RESET} ${DIM}${cmd.description}${RESET}`;
}