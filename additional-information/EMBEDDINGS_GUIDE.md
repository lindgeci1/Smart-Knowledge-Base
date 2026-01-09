# Embeddings Guide for Smart Knowledge Base

## What Are Embeddings?

**Embeddings** are numerical representations (vectors) of text that capture semantic meaning. They're arrays of numbers (typically 384, 768, or 1536 dimensions) that allow you to:

- Find similar content by comparing vectors
- Search semantically (not just keyword matching)
- Enable RAG (Retrieval Augmented Generation) - finding relevant context before answering

**Example:**

- "What is machine learning?" → `[0.23, -0.45, 0.12, ...]` (1536 numbers)
- "Tell me about AI" → `[0.25, -0.43, 0.15, ...]` (similar numbers = similar meaning)

## How to Use Embeddings

### 1. **Semantic Search**

Find documents/messages similar to a query, even if they don't share exact keywords.

### 2. **RAG (Retrieval Augmented Generation)**

1. User asks a question
2. Convert question to embedding
3. Find most similar document chunks/summaries
4. Use those as context for AI response

### 3. **Chat Context Retrieval**

Find previous chat messages or documents relevant to current conversation.

## Storage Strategy

### Option 1: Store in Existing Collections (Recommended for MongoDB Atlas)

**Add embedding field to existing models:**

```csharp
// In ChatMessage.cs
[BsonElement("embedding")]
public float[]? Embedding { get; set; } // Store as array of floats

// In Document.cs
[BsonElement("embedding")]
public float[]? Embedding { get; set; }

// In Text.cs
[BsonElement("embedding")]
public float[]? Embedding { get; set; }
```

**Pros:**

- Simple - everything in one place
- Easy to query with MongoDB Atlas Vector Search
- No extra collections to manage

**Cons:**

- Larger document size (each embedding is ~6KB for 1536 dimensions)
- Slower queries if you have many documents

### Option 2: Separate Embeddings Collection

Create a dedicated collection for embeddings:

```csharp
public class Embedding
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? EmbeddingId { get; set; }

    [BsonElement("entityType")] // "document", "text", "chat_message"
    public string EntityType { get; set; }

    [BsonElement("entityId")] // Reference to DocumentId, TextId, or ChatMessageId
    public string EntityId { get; set; }

    [BsonElement("content")] // Original text that was embedded
    public string Content { get; set; }

    [BsonElement("embedding")]
    public float[] EmbeddingVector { get; set; } // The actual vector

    [BsonElement("userId")]
    public string UserId { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

**Pros:**

- Keeps main collections lightweight
- Easier to manage and index
- Can embed different content (chunks, summaries, etc.)

**Cons:**

- Need to join/query two collections
- More complex queries

## When to Create Embeddings

### ✅ **Create Embeddings For:**

1. **Document Summaries** (when document is summarized)

   - Embed the summary text
   - Use for: Finding relevant documents for chat

2. **Text Summaries** (when text is summarized)

   - Embed the summary text
   - Use for: Finding relevant texts for chat

3. **Chat Messages** (optional - only if you want semantic chat search)
   - Embed user questions
   - Embed AI responses (optional)
   - Use for: Finding similar past conversations

### ❌ **Don't Create Embeddings For:**

- Every single message (too expensive, not always needed)
- Very short messages (< 10 words - not enough semantic meaning)
- System messages or error messages

## Recommended Approach for Your System

### 1. **Embed Document/Text Summaries** (High Priority)

When a document or text is summarized, create an embedding of the summary.

**Use Case:** When user asks a question in chat, find the most relevant document/text to use as context.

### 2. **Embed User Questions in Chat** (Medium Priority)

When a user sends a message, optionally create an embedding.

**Use Case:** Find similar past questions/answers for context.

### 3. **Chunk Large Documents** (Advanced)

For very long documents, split into chunks and embed each chunk.

**Use Case:** More precise retrieval from large documents.

## Implementation Steps

### Step 1: Create Embedding Service

```csharp
// Services/EmbeddingService.cs
public class EmbeddingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public EmbeddingService(IConfiguration configuration)
    {
        _configuration = configuration;
        _httpClient = new HttpClient();
        _httpClient.Timeout = TimeSpan.FromMinutes(1);
    }

    // Generate embedding using Ollama's embedding model
    public async Task<float[]> GenerateEmbeddingAsync(string text)
    {
        var apiKey = Environment.GetEnvironmentVariable("OLLAMA_API_KEY");
        var embeddingModel = Environment.GetEnvironmentVariable("OLLAMA_EMBEDDING_MODEL")
            ?? "nomic-embed-text"; // Good free embedding model

        if (string.IsNullOrEmpty(text) || text.Length < 10)
        {
            throw new ArgumentException("Text must be at least 10 characters");
        }

        string requestUrl;
        bool isCloud = !string.IsNullOrEmpty(apiKey);

        if (isCloud)
        {
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
            requestUrl = "https://ollama.com/api/embeddings";
        }
        else
        {
            var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_BASE_URL")
                ?? "http://localhost:11434";
            requestUrl = $"{ollamaUrl}/api/embeddings";
        }

        var request = new
        {
            model = embeddingModel,
            prompt = text // For cloud, might be "input" instead
        };

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync(requestUrl, content);
        response.EnsureSuccessStatusCode();

        var responseString = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseString);

        // Parse embedding array
        var embeddingArray = doc.RootElement
            .GetProperty("embedding")
            .EnumerateArray()
            .Select(x => (float)x.GetDouble())
            .ToArray();

        return embeddingArray;
    }
}
```

### Step 2: Update Models

Add embedding field to `Document.cs` and `Text.cs`:

```csharp
[BsonElement("embedding")]
public float[]? Embedding { get; set; }
```

### Step 3: Generate Embeddings When Summarizing

In `SummarizationService.cs`, after generating summary:

```csharp
// After summary is created
var embeddingService = new EmbeddingService(_configuration);
try
{
    var embedding = await embeddingService.GenerateEmbeddingAsync(summary);
    document.Embedding = embedding;
}
catch (Exception ex)
{
    // Log but don't fail - embedding is optional
    Console.WriteLine($"Failed to generate embedding: {ex.Message}");
}
```

### Step 4: Create Vector Search Index (MongoDB Atlas)

In MongoDB Atlas:

1. Go to your database
2. Create Search Index
3. Use JSON Editor:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768, // or 1536 depending on your model
      "similarity": "cosine"
    }
  ]
}
```

### Step 5: Query Similar Documents

```csharp
// Find documents similar to a query
public async Task<List<Document>> FindSimilarDocumentsAsync(
    string query,
    string userId,
    int limit = 5)
{
    var embeddingService = new EmbeddingService(_configuration);
    var queryEmbedding = await embeddingService.GenerateEmbeddingAsync(query);

    // MongoDB Atlas Vector Search
    var pipeline = new BsonDocument[]
    {
        new BsonDocument("$vectorSearch", new BsonDocument
        {
            { "index", "vector_index" }, // Your index name
            { "path", "embedding" },
            { "queryVector", new BsonArray(queryEmbedding.Select(e => new BsonDouble(e))) },
            { "numCandidates", limit * 10 },
            { "limit", limit }
        }),
        new BsonDocument("$match", new BsonDocument("userId", userId))
    };

    return await _documentCollection
        .Aggregate<Document>(pipeline)
        .ToListAsync();
}
```

## Embedding Models

### Free/Open Source:

- **nomic-embed-text** (768 dimensions) - Good quality, fast
- **all-minilm** (384 dimensions) - Smaller, faster, less accurate

### Cloud (Ollama.com):

- Uses same models but via API
- Requires API key

### Dimensions:

- **384**: Fast, smaller storage, less accurate
- **768**: Balanced (recommended)
- **1536**: Most accurate, slower, larger storage

## Cost Considerations

- **Storage**: Each embedding ~3-6KB (768-1536 dimensions)
- **API Calls**: Generating embeddings costs API credits
- **Recommendation**: Only embed summaries, not every message

## Example: RAG Flow

1. User asks: "What are the main points in my Q4 report?"
2. Generate embedding for the question
3. Search for similar document summaries
4. Find "Q4_Report.pdf" summary (most similar)
5. Use that summary as context for AI response
6. AI answers based on the retrieved summary

## Best Practices

1. **Only embed meaningful content** (summaries, not raw files)
2. **Batch embedding generation** (don't do it synchronously during upload)
3. **Cache embeddings** (don't regenerate if content hasn't changed)
4. **Use appropriate model** (768 dimensions is usually enough)
5. **Index properly** (create vector search index in MongoDB Atlas)

## Summary

- **What**: Numerical vectors representing text meaning
- **When**: Embed document/text summaries (not every message)
- **Where**: Add `embedding` field to existing collections OR create separate collection
- **How**: Use Ollama embedding API, store as `float[]` array
- **Why**: Enable semantic search and RAG for better chat responses
