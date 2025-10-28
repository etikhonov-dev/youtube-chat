import readline from 'readline';
import { COMMANDS } from './commands.js';

// ANSI escape codes
const CYAN = '\x1b[36m';
const BOLD_CYAN = '\x1b[1;36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Global flag to track if a selection prompt is active
let selectionPromptActive = false;

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
    lines.push(`${DIM}↑/↓ • Tab/Enter • Esc${RESET}`);

    // Calculate cursor position for restoration
    const promptLength = rl._prompt.length;
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

      // Don't handle events if a selection prompt is active
      if (selectionPromptActive) {
        return;
      }

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

/**
 * Create a selection prompt with arrow key navigation
 * @param {Array<{label: string, description: string, icon?: string}>} options - Array of options to select from
 * @param {string} title - Title for the prompt
 * @param {number} defaultIndex - Default selected index (default: 0)
 * @returns {Promise<number|null>} Selected index or null if cancelled
 */
export function createSelectionPrompt(options, title, defaultIndex = 0) {
  return new Promise((resolve) => {
    let selectedIndex = defaultIndex;
    let promptVisible = true;
    let totalLines = 0;
    let dynamicLines = 0;

    // Mark selection prompt as active to prevent dropdown interference
    selectionPromptActive = true;

    // Store original stdin state (ensure it's a boolean)
    const wasRawMode = Boolean(process.stdin.isRaw);

    // Set up a timeout to ensure the promise settles
    const timeout = setTimeout(() => {
      // This ensures Node.js knows the promise will eventually settle
      // It won't actually trigger unless there's a real hang
    }, 300000).unref(); // 5 minutes, unref so it doesn't keep process alive

    /**
     * Clear dynamic menu lines (options + footer)
     */
    function clearDynamicLines() {
      if (dynamicLines === 0) return;

      // Move cursor up to start of dynamic content
      process.stdout.write(`\x1b[${dynamicLines}A`);

      // Clear each line
      for (let i = 0; i < dynamicLines; i++) {
        process.stdout.write('\x1b[2K'); // Clear current line
        if (i < dynamicLines - 1) {
          process.stdout.write('\x1b[1B'); // Move down one line
        }
      }

      // Move cursor back to start of dynamic area
      process.stdout.write(`\x1b[${dynamicLines - 1}A\r`);
    }

    /**
     * Render the selection prompt
     */
    function renderPrompt(isInitial = false) {
      if (!isInitial) {
        clearDynamicLines();
      }

      if (isInitial) {
        // Title with modern minimal design
        process.stdout.write(`\n${BOLD_CYAN}${title}${RESET}\n`);
        process.stdout.write(`${DIM}${'─'.repeat(title.length)}${RESET}\n\n\n`);
        totalLines = 5; // blank + title + separator + 2 blanks
      }

      // Render options
      options.forEach((option, index) => {
        const indicator = index === selectedIndex ? `${CYAN}❯${RESET} ` : '  ';
        const style = index === selectedIndex ? BOLD_CYAN : CYAN;
        const icon = option.icon ? `${option.icon} ` : '';
        const labelPadded = (icon + option.label).padEnd(25);
        process.stdout.write(`${indicator}${style}${labelPadded}${RESET} ${DIM}${option.description}${RESET}\n`);
      });

      // Footer
      process.stdout.write(`\n${DIM}Enter to confirm • Esc to cancel${RESET}\n`);

      // Track dynamic lines (options + blank line + footer)
      dynamicLines = options.length + 2;
    }

    /**
     * Clean up and finalize
     */
    function finalize() {
      // Move cursor up to the first line of dynamic content
      if (dynamicLines > 0) {
        process.stdout.write(`\x1b[${dynamicLines}A`);
      }

      // Clear all dynamic lines
      for (let i = 0; i < dynamicLines; i++) {
        process.stdout.write('\x1b[2K'); // Clear entire line
        if (i < dynamicLines - 1) {
          process.stdout.write('\x1b[1B'); // Move down
        }
      }

      // Move up to start of static content (title area)
      if (totalLines > 0) {
        process.stdout.write(`\x1b[${totalLines}A`);
      }

      // Clear all static lines
      for (let i = 0; i < totalLines; i++) {
        process.stdout.write('\x1b[2K'); // Clear entire line
        if (i < totalLines - 1) {
          process.stdout.write('\x1b[1B'); // Move down
        }
      }

      // Move cursor back to where menu started (top)
      if (totalLines > 0) {
        process.stdout.write(`\x1b[${totalLines}A\r`);
      }
    }

    // Keypress handler
    const keypressHandler = (_str, key) => {
      if (!key || !promptVisible) return;

      if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % options.length;
        renderPrompt(false);
        return;
      } else if (key.name === 'up') {
        selectedIndex = selectedIndex === 0 ? options.length - 1 : selectedIndex - 1;
        renderPrompt(false);
        return;
      } else if (key.name === 'return' || key.name === 'enter') {
        promptVisible = false;
        finalize();

        // Clear the timeout
        clearTimeout(timeout);

        // Clean up only our handler
        process.stdin.removeListener('keypress', keypressHandler);
        // Restore original raw mode state
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(wasRawMode);
        }
        // Mark selection prompt as inactive
        selectionPromptActive = false;
        // Resolve immediately after cleanup
        resolve(selectedIndex);
      } else if (key.name === 'escape') {
        promptVisible = false;
        finalize();

        // Clear the timeout
        clearTimeout(timeout);

        // Clean up only our handler
        process.stdin.removeListener('keypress', keypressHandler);
        // Restore original raw mode state
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(wasRawMode);
        }
        // Mark selection prompt as inactive
        selectionPromptActive = false;
        // Resolve immediately after cleanup
        resolve(null);
      } else if (key.ctrl && key.name === 'c') {
        promptVisible = false;
        process.stdin.removeListener('keypress', keypressHandler);
        // Mark selection prompt as inactive before exiting
        selectionPromptActive = false;
        process.exit(0);
      }
    };

    // Set up raw mode for keypress
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // Initial render
    renderPrompt(true);

    // Attach our keypress handler
    process.stdin.on('keypress', keypressHandler);
  });
}

/**
 * Create a text input prompt with cancel support
 * @param {string} prompt - Prompt text to display
 * @param {string} defaultValue - Default value to use if input is empty
 * @param {string} hint - Hint text to show below input
 * @returns {Promise<string|null>} Input value or null if cancelled
 */
export function createTextPrompt(prompt, defaultValue = '', hint = '') {
  return new Promise((resolve, reject) => {
    // Mark selection prompt as active to prevent dropdown interference
    selectionPromptActive = true;

    // Store original stdin state (ensure it's a boolean)
    const wasRawMode = Boolean(process.stdin.isRaw);

    console.log(`\n${prompt}`);
    if (hint) {
      console.log(`\n${DIM}${hint}${RESET}\n`);
    }
    process.stdout.write('> ');

    let input = '';
    let resolved = false;

    const dataHandler = (chunk) => {
      if (resolved) return;

      const str = chunk.toString();

      // Handle Enter key
      if (str.includes('\n') || str.includes('\r')) {
        resolved = true;

        // Clean up
        process.stdin.removeListener('data', dataHandler);
        process.stdin.pause();

        // Restore original raw mode state if needed
        if (process.stdin.isTTY && wasRawMode !== process.stdin.isRaw) {
          process.stdin.setRawMode(wasRawMode);
        }

        // Mark selection prompt as inactive
        selectionPromptActive = false;

        // Resolve with input or default
        const result = input.trim() || defaultValue;
        process.stdout.write('\n');
        resolve(result);
      } else {
        // Accumulate input
        input += str;
        // Echo the input
        process.stdout.write(str);
      }
    };

    // Resume stdin and listen for data
    process.stdin.resume();
    process.stdin.on('data', dataHandler);
  });
}