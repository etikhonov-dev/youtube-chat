# YouTube Chat

Chat with any YouTube video using AI. Ask questions, explore topics, and get instant answers from video transcripts.

## What You Can Do

- **Chat with any YouTube video** that has transcripts/captions available
- **Get main topics covered** automatically when you start
- **Ask follow-up questions** and have natural conversations about the content
- **Export conversations** to clipboard or save to a file for later reference
- Get answers with **precise timestamps** showing where information appears in the video

## Prerequisites

- Node.js (v18 or higher recommended)
- Google API Key for Gemini API
  - Get one at: https://ai.google.dev/

## Installation

1. Clone the repository from GitHub:
   ```bash
   git clone https://github.com/Genebio/youtube-chat.git
   cd youtube-chat
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Link the package globally:
   ```bash
   yarn link
   ```

4. Set up your Google API key:
   ```bash
   export GOOGLE_API_KEY='your_api_key_here'
   ```

## Usage

Start chatting with any YouTube video:

```bash
ytchat https://youtu.be/bZQun8Y4L2A
```

### What Happens Next

1. **Video loads** - You'll see the title, author, and duration
2. **Topics summary** - Main topics covered in the video are automatically generated
3. **Chat begins** - Ask any questions about the video content

### Example Conversation

```
You: What is this video about?
Assistant: [Answer with relevant timestamps]

You: Can you tell me more about [specific topic]?
Assistant: [Detailed explanation with timestamps]

You: What are the key takeaways?
Assistant: [Summary with references to video sections]
```

### Export Your Conversation

Save your conversation for later reference:

```
You: /export
```

Choose to either:
- **Copy to clipboard** - Paste into any document
- **Save to file** - Creates a timestamped text file in your current directory

### Commands

- `exit` or `quit` - End the chat session
- `/export` - Export conversation to clipboard or file
- `Ctrl+C` - Quick exit

## Tips for Best Results

- **Videos must have captions** - The video needs transcripts/subtitles available
- **Be specific** - Clear questions get better answers
- **Follow up** - Ask for more details or clarification on any topic
- **Use the summary** - Review the auto-generated topics first to understand what's covered
- **Export often** - Save interesting conversations for later reference

## Troubleshooting

**"Failed to load transcript"**
- Video may not have captions enabled
- Try a different video with subtitles

**API Key errors**
- Ensure GOOGLE_API_KEY is set correctly
- Check your API key is valid at https://aistudio.google.com/

**Slow responses**
- First initialization takes time (loading + embedding)
- Subsequent questions should be faster
- Consider reducing chunk size for shorter videos

## License

This project is licensed for **non-commercial use only**.

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to use the Software for personal, educational, and non-commercial purposes only, subject to the following conditions:

- The Software may not be used for commercial purposes without explicit written permission from the copyright holder.
- The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.