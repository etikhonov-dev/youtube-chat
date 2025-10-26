# Testing Option+Arrow Keys

## Instructions

1. Run your youtube-chat command with any video URL
2. Type some text: `hello world from youtube chat`
3. Press Option+Left arrow several times
4. Press Option+Right arrow several times
5. Exit the session
6. Check the debug log: `cat /tmp/youtube-chat-debug.log`

## Expected Behavior

- **Option+Left**: Cursor should jump backward by word
- **Option+Right**: Cursor should jump forward by word

## Debug Log Location

The debug log will be created at: `/tmp/youtube-chat-debug.log`

## What to Look For

The log should show entries like:
```
Key pressed: name="b", meta=true, ctrl=false, shift=false, sequence="..."
Key pressed: name="f", meta=true, ctrl=false, shift=false, sequence="..."
```

If you see different key names or meta=false, that means the terminal is sending different key codes than expected.

## Common Terminal Differences

- **iTerm2**: May send different escape sequences
- **VSCode Terminal**: May intercept Option+Arrow for its own shortcuts
- **Terminal.app**: Should send the expected 'b' and 'f' with meta key

## After Testing

Report what you see in the debug log, and I'll adjust the key detection logic accordingly.
