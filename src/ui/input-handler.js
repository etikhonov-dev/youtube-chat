import readline from 'readline';
import { COMMANDS } from './commands.js';

// ANSI escape codes
const CYAN = '\x1b[36m';
const BOLD_CYAN = '\x1b[1;36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Create enhanced input handler with command dropdown
 * @returns {Object} Input handler interface
 */
export function createInputHandler() {
  let dropdownVisible = false;
  let selectedIndex = 0;
  let filteredCommands = [];
  let dropdownLines = 0;

  /**
   * Clear dropdown from screen
   */
  function clearDropdown() {
    if (!dropdownVisible || dropdownLines === 0) return;

    // Clear the dropdown lines below the input
    for (let i = 0; i < dropdownLines; i++) {
      process.stdout.write('\n\x1b[2K'); // Move down and clear line
    }
    // Move cursor back up to original position
    process.stdout.write(`\x1b[${dropdownLines}A\r`); // Move up and to start of line

    dropdownVisible = false;
    dropdownLines = 0;
  }

  /**
   * Render dropdown below current line
   * @param {string} currentInput - Current input text (e.g., "/exp")
   * @param {Object} rl - Readline interface
   */
  function renderDropdown(currentInput, rl) {
    // Filter commands based on input
    const searchTerm = currentInput.toLowerCase();
    filteredCommands = COMMANDS.filter(cmd =>
      cmd.name.startsWith(searchTerm)
    );

    if (filteredCommands.length === 0) {
      if (dropdownVisible) {
        clearDropdown();
      }
      return;
    }

    // Ensure selected index is valid
    if (selectedIndex >= filteredCommands.length) {
      selectedIndex = 0;
    }

    // Clear previous dropdown if visible
    if (dropdownVisible) {
      clearDropdown();
    }

    // Build dropdown lines
    const lines = [];
    filteredCommands.forEach((cmd, index) => {
      const indicator = index === selectedIndex ? `${CYAN}❯${RESET} ` : '  ';
      const style = index === selectedIndex ? BOLD_CYAN : CYAN;
      const namePadded = cmd.name.padEnd(10);
      lines.push(`${indicator}${style}${namePadded}${RESET} ${DIM}${cmd.description}${RESET}`);
    });

    // Footer
    lines.push(`${DIM}↑/↓ or j/k • Tab/Enter • Esc${RESET}`);

    // Calculate cursor position for restoration
    const promptLength = rl._prompt.length;
    const inputLength = rl.line.length;
    const cursorPosition = promptLength + rl.cursor;

    // Write dropdown below current line
    lines.forEach(line => {
      process.stdout.write('\n' + line);
    });

    dropdownLines = lines.length;
    dropdownVisible = true;

    // Move cursor back up to input line
    process.stdout.write(`\x1b[${dropdownLines}A`);
    // Move cursor to correct column position
    process.stdout.write(`\r\x1b[${cursorPosition}C`);
  }

  /**
   * Accept selected command
   * @param {Object} rl - Readline interface
   */
  function acceptCommand(rl) {
    if (!dropdownVisible || filteredCommands.length === 0) return false;

    const selected = filteredCommands[selectedIndex];

    // Clear dropdown
    clearDropdown();

    // Update readline with selected command
    rl.line = selected.name;
    rl.cursor = selected.name.length;
    rl._refreshLine();

    return true;
  }

  /**
   * Attach keypress handler to readline interface
   * @param {Object} rl - Readline interface
   */
  function attachKeypressHandler(rl) {
    // Enable keypress events
    readline.emitKeypressEvents(process.stdin, rl);

    // Track last line content
    let lastLine = '';
    let isNavigating = false;

    process.stdin.on('keypress', (_str, key) => {
      if (!key) return;

      // Handle dropdown navigation
      if (dropdownVisible && !isNavigating) {
        if (key.name === 'down') {
          isNavigating = true;
          selectedIndex = (selectedIndex + 1) % filteredCommands.length;
          renderDropdown(rl.line, rl);
          isNavigating = false;
          return;
        }

        if (key.name === 'up') {
          isNavigating = true;
          selectedIndex = selectedIndex === 0 ? filteredCommands.length - 1 : selectedIndex - 1;
          renderDropdown(rl.line, rl);
          isNavigating = false;
          return;
        }

        if (key.name === 'j' && !key.ctrl && !key.meta) {
          isNavigating = true;
          selectedIndex = (selectedIndex + 1) % filteredCommands.length;
          renderDropdown(rl.line, rl);
          isNavigating = false;
          return;
        }

        if (key.name === 'k' && !key.ctrl && !key.meta) {
          isNavigating = true;
          selectedIndex = selectedIndex === 0 ? filteredCommands.length - 1 : selectedIndex - 1;
          renderDropdown(rl.line, rl);
          isNavigating = false;
          return;
        }

        if (key.name === 'tab') {
          acceptCommand(rl);
          return;
        }

        if (key.name === 'escape') {
          clearDropdown();
          rl._refreshLine();
          return;
        }
      }

      // Update dropdown on regular input (after readline processes the key)
      setImmediate(() => {
        const line = rl.line;

        if (line !== lastLine && !isNavigating) {
          if (line.startsWith('/') && line.length > 0) {
            selectedIndex = 0;
            renderDropdown(line, rl);
          } else if (dropdownVisible) {
            clearDropdown();
            rl._refreshLine();
          }
          lastLine = line;
        }
      });
    });

    // Clean up on close
    rl.on('close', () => {
      if (dropdownVisible) {
        clearDropdown();
      }
    });
  }

  return {
    attachKeypressHandler,
    clearDropdown,
  };
}