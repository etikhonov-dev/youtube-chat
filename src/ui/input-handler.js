import readline from 'readline';
import enquirer from 'enquirer';
const { AutoComplete } = enquirer;
import { COMMANDS, formatCommand } from './commands.js';

// ANSI escape codes
const CYAN = '\x1b[36m';
const BOLD_CYAN = '\x1b[1;36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Create enhanced input handler with command dropdown
 * @param {Function} onCommand - Callback when command selected: (commandName) => Promise<void>
 * @returns {Object} Input handler interface
 */
export function createInputHandler(onCommand) {
  let dropdownActive = false;

  /**
   * Show command dropdown when "/" is typed
   * @param {string} partialInput - Partial command input (e.g., "/", "/ex")
   */
  async function showCommandDropdown(partialInput = '/') {
    if (dropdownActive) return;
    dropdownActive = true;

    try {
      // Filter commands based on partial input
      const matchingCommands = COMMANDS.filter(cmd =>
        cmd.name.startsWith(partialInput.toLowerCase())
      );

      if (matchingCommands.length === 0) {
        dropdownActive = false;
        return;
      }

      // Single match - auto-complete if exact match
      if (matchingCommands.length === 1 && matchingCommands[0].name === partialInput.toLowerCase()) {
        const selected = matchingCommands[0].name;
        dropdownActive = false;
        await onCommand(selected);
        return;
      }

      // Create autocomplete prompt with programmer-friendly styling
      const prompt = new AutoComplete({
        name: 'command',
        message: '',
        limit: 10,
        initial: 0,
        choices: matchingCommands.map(cmd => ({
          name: cmd.name,
          message: formatCommand(cmd),
          value: cmd.name,
        })),
        styles: {
          primary: (str) => `${CYAN}${str}${RESET}`,
          selected: (str) => `${BOLD_CYAN}${str}${RESET}`,
          em: (str) => `\x1b[1m${str}${RESET}`,
        },
        symbols: {
          indicator: `${CYAN}❯${RESET}`,
          pointer: `${CYAN}›${RESET}`,
        },
        footer() {
          return `${DIM}↑/↓ or j/k • Enter • Esc${RESET}`;
        },
      });

      // Override keypress for vim-style navigation
      const originalKeypress = prompt.keypress.bind(prompt);
      prompt.keypress = async function(input, key = {}) {
        // Vim keybindings for programmers
        if (key.name === 'j') {
          this.next();
          return;
        }
        if (key.name === 'k') {
          this.prev();
          return;
        }
        // Call original keypress handler
        return originalKeypress(input, key);
      };

      const selected = await prompt.run();
      await onCommand(selected);
    } catch (error) {
      // User cancelled (Esc) - do nothing
    } finally {
      dropdownActive = false;
    }
  }

  /**
   * Attach keypress handler to readline interface
   * @param {Object} rl - Readline interface
   */
  function attachKeypressHandler(rl) {
    // Enable keypress events
    readline.emitKeypressEvents(process.stdin, rl);

    // Monitor cursor position and input changes
    let lastLine = '';
    const checkInput = () => {
      const currentLine = rl.line;

      // Check if user just typed "/" at the start
      if (currentLine === '/' && lastLine === '' && !dropdownActive) {
        // Show dropdown without clearing the "/"
        setImmediate(async () => {
          await showCommandDropdown('/');
          // Restore prompt after dropdown closes
          if (!dropdownActive) {
            rl.prompt();
          }
        });
      }

      lastLine = currentLine;
    };

    // Use interval to check for input changes (lightweight approach)
    const checkInterval = setInterval(checkInput, 50);

    // Clean up on close
    rl.on('close', () => {
      clearInterval(checkInterval);
    });
  }

  return {
    attachKeypressHandler,
    showCommandDropdown,
  };
}