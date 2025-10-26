#!/usr/bin/env node

import { startChatInterface } from "./src/ui/chat.js";

// Simple test entry point
(async () => {
  await startChatInterface();
})();
