# Embeddings Implementation - OpenRouter & Gemini

## ✅ Implementation Complete

Embeddings are now **required** and use **OpenRouter (primary)** or **Gemini (fallback)** for generating embeddings, while **Ollama remains for chat/summarization**.

## How It Works

### Provider Priority:
1. **OpenRouter** (Primary) - Tried first if `OPENROUTER_API_KEY` is set
2. **Gemini** (Fallback) - Used if OpenRouter fails or is not available

### Why OpenRouter?
- ✅ OpenAI-compatible format (easier to implement)
- ✅ Supports multiple embedding models
- ✅ More reliable and well-documented
- ✅ Better error handling

### Why Gemini as Fallback?
- ✅ Google's robust embedding model
- ✅ Good quality embeddings
- ✅ Alternative if OpenRouter has issues

## Environment Variables Required

### For Embeddings (REQUIRED - at least one):
```bash
# Option 1: OpenRouter (Recommended)
OPENROUTER_API_KEY=your-openrouter-key-here

# Optional: Choose embedding model (default: openai/text-embedding-3-small)
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
# Other options:
# - openai/text-embedding-3-large (3072 dimensions)
# - openai/text-embedding-ada-002 (1536 dimensions)

# Option 2: Gemini (Fallback)
GEMINI_API_KEY=your-gemini-key-here
```

### For Chat/Summarization (Keep as is):
```bash
OLLAMA_API_KEY=your-ollama-key-here  # Still used for chat
OLLAMA_MODEL=gpt-oss:120b-cloud       # Your chat model
```

## What Changed

### ✅ EmbeddingService.cs
- **Before:** Used Ollama for embeddings (which doesn't support it)
- **Now:** Uses OpenRouter → Gemini fallback
- **Return Type:** Changed from `Task<float[]?>` to `Task<float[]>` (required, not optional)
- **Error Handling:** Throws exceptions instead of returning null

### ✅ Controllers
- Updated comments to reflect required embeddings
- Controllers already handle non-nullable return type correctly

### ✅ Chat/Summarization
- **Unchanged** - Still uses Ollama API
- Only embeddings changed to OpenRouter/Gemini

## API Endpoints Used

### OpenRouter:
- **Endpoint:** `https://openrouter.ai/api/v1/embeddings`
- **Format:** OpenAI-compatible
- **Response:** `{"data": [{"embedding": [...]}]}`

### Gemini:
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key={apiKey}`
- **Format:** Google Gemini API
- **Response:** `{"embedding": {"values": [...]}}`

## Testing

1. **Set your API keys:**
   ```powershell
   $env:OPENROUTER_API_KEY = "your-key"
   # OR
   $env:GEMINI_API_KEY = "your-key"
   ```

2. **Upload a document** - Embeddings will be generated automatically

3. **Check console logs:**
   ```
   [EmbeddingService] Generated OpenRouter embedding (openai/text-embedding-3-small): 1536 dimensions
   ```

4. **Test RAG in chat** - Ask questions without selecting a document to see semantic search in action

## Troubleshooting

### Error: "Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is set"
- **Solution:** Set at least one of these environment variables

### Error: "OpenRouter failed, trying Gemini"
- **Solution:** OpenRouter had an issue, Gemini will be used as fallback
- Check OpenRouter API key validity

### Error: "Both OpenRouter and Gemini embeddings failed"
- **Solution:** Check both API keys are valid
- Verify network connectivity
- Check API quotas/limits

### Different embedding dimensions?
- **OpenRouter (text-embedding-3-small):** 1536 dimensions
- **OpenRouter (text-embedding-3-large):** 3072 dimensions
- **Gemini (embedding-001):** 768 dimensions
- **Note:** All embeddings work together - dimension differences are handled automatically

## Debugging

The service logs detailed information:
- Which provider is being used
- Model name
- Embedding dimensions
- Any errors with full details

Check your console output for `[EmbeddingService]` messages.

