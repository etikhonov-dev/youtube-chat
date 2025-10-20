# YouTube Chat - LangChain Conversational Agent

A conversational AI agent that lets you chat with YouTube videos using LangChain, Google Gemini 2.0 Flash, and vector embeddings.

## Features

- **Intelligent Q&A**: Ask questions about any YouTube video with captions
- **Timestamp References**: Get answers with precise timestamps showing where information appears in the video
- **Conversational Memory**: The agent remembers context from previous questions in the same session
- **Agent with Tools**: Uses ReAct agent pattern to intelligently search and reason about video content
- **In-Memory Vector Store**: Fast semantic search without external dependencies

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
   npm install
   ```

3. Link the package globally:
   ```bash
   npm link
   ```

4. Set up your Google API key:
   ```bash
   export GOOGLE_API_KEY='your_api_key_here'
   ```

## Usage

### Basic Usage

```bash
ytchat <youtube-url>
```

### Example

```bash
ytchat https://youtu.be/bZQun8Y4L2A
```

### Interactive Session

Once started, you'll see:
- Video metadata (title, author, duration)
- Processing status
- Interactive prompt for questions

Example conversation:
```
You: What is this video about?
Assistant: [Answer with timestamps]

You: What does he say about X?
Assistant: [Detailed answer with source timestamps]

You: Tell me more about that
Assistant: [Contextual follow-up using conversation memory]

You: exit
```

## How It Works

### Architecture

1. **YouTube Loader**: Fetches video transcript with timestamps
2. **Text Splitter**: Chunks transcript into 1000-character segments with overlap
3. **Embeddings**: Uses Google's text-embedding-004 model
4. **Vector Store**: In-memory MemoryVectorStore for fast semantic search
5. **Agent**: ReAct agent with two tools:
   - `search_transcript`: Semantic search across video content
   - `get_video_info`: Retrieves video metadata
6. **LLM**: Gemini 2.0 Flash for reasoning and generation
7. **Memory**: ConversationBufferMemory for context retention

### Agent Tools

**search_transcript**
- Searches video transcript using semantic similarity
- Returns relevant sections with timestamps
- Configurable number of results

**get_video_info**
- Returns video title, author, duration, description
- Used when asking about the video itself

## Configuration

### Customization Options

Edit `index.js` to adjust:

**Chunk Size** (line 71-73):
```javascript
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,        // Larger = more context per chunk
  chunkOverlap: 200,      // Prevents splitting related content
});
```

**Agent Parameters** (line 139-145):
```javascript
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  // temperature: 0,          // 0 = deterministic, 1 = creative
  maxRetries: 2,
});
```

**Search Results** (line 108-111):
```javascript
func: async ({ query, numResults = 4 }) => {
  // Change default from 4 to get more/fewer results
```

## Tips

- Videos must have captions/subtitles available
- Longer videos take more time to process initially
- Be specific in your questions for better results
- Use follow-up questions to dig deeper on topics
- The agent uses timestamps automatically when relevant

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