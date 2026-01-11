using System.Text;
using System.Text.Json;

namespace SmartKB.Services
{
    /// <summary>
    /// Generates embeddings using Gemini API (FREE - 1,500 requests/day)
    /// 768 dimensions, optimized for RAG/semantic search
    /// </summary>
    public class EmbeddingService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly string _geminiApiKey;
        private readonly string _geminiEmbeddingModel;
        private const int OUTPUT_DIMENSIONS = 768;

        public EmbeddingService(IConfiguration configuration)
        {
            _configuration = configuration;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromMinutes(2);
            
            _geminiApiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY") 
                ?? configuration["GEMINI_API_KEY"]
                ?? throw new Exception("GEMINI_API_KEY not found in environment or configuration");

            _geminiEmbeddingModel = Environment.GetEnvironmentVariable("GEMINI_EMBEDDING_MODEL")
                ?? configuration["GEMINI_EMBEDDING_MODEL"]
                ?? "gemini-embedding-001";
        }

        /// <summary>
        /// Generates an embedding vector from text using Gemini API (FREE)
        /// Returns 768-dimensional normalized embeddings optimized for RAG
        /// </summary>
        /// <param name="text">Text to embed (should be at least 10 characters)</param>
        /// <returns>Array of floats representing the embedding vector (768 dimensions)</returns>
        public async Task<float[]> GenerateEmbeddingAsync(string text)
        {
            if (string.IsNullOrWhiteSpace(text) || text.Length < 10)
            {
                throw new ArgumentException("Text must be at least 10 characters to generate meaningful embedding");
            }

            try
            {
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_geminiEmbeddingModel}:embedContent?key={_geminiApiKey}";

                var requestBody = new
                {
                    content = new
                    {
                        parts = new[]
                        {
                            new { text = text }
                        }
                    },
                    taskType = "RETRIEVAL_DOCUMENT",
                    outputDimensionality = OUTPUT_DIMENSIONS
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"[EmbeddingService] ❌ Gemini API error: {response.StatusCode} - {errorContent}");
                    throw new Exception($"Failed to generate embedding: {response.StatusCode} - {errorContent}");
                }

                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);

                if (doc.RootElement.TryGetProperty("embedding", out var embeddingObj) &&
                    embeddingObj.TryGetProperty("values", out var valuesElement))
                {
                    var embeddingArray = valuesElement
                        .EnumerateArray()
                        .Select(x => (float)x.GetDouble())
                        .ToArray();

                    Console.WriteLine($"[EmbeddingService] ✅ Generated {embeddingArray.Length}D embedding via Gemini");
                    return embeddingArray;
                }

                throw new Exception($"Unexpected Gemini API response format: {doc.RootElement}");
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"[EmbeddingService] ❌ Failed to connect to Gemini API: {ex.Message}");
                throw new Exception($"Gemini embedding API not available. Error: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmbeddingService] ❌ Error calling Gemini API: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Calculates cosine similarity between two NORMALIZED embedding vectors
        /// Optimized: Since embeddings are normalized (unit vectors) from sentence-transformers,
        /// cosine similarity = dot product (magnitudes are both 1, so division by magnitude is unnecessary)
        /// This is the standard and most efficient approach for normalized embeddings
        /// </summary>
        public double CalculateCosineSimilarity(float[] vector1, float[] vector2)
        {
            if (vector1.Length != vector2.Length)
            {
                throw new ArgumentException("Vectors must have the same length");
            }

            // Since embeddings are normalized (unit vectors) from sentence-transformers with normalize_embeddings=True,
            // cosine similarity = dot product (magnitudes are both 1)
            // Formula: cos(θ) = (A · B) / (|A| * |B|) = (A · B) / (1 * 1) = A · B
            double dotProduct = 0;
            for (int i = 0; i < vector1.Length; i++)
            {
                dotProduct += vector1[i] * vector2[i];
            }

            // Clamp to [-1, 1] range (should already be in this range for normalized vectors, but safety check)
            // Cosine similarity is always between -1 and 1
            return Math.Max(-1.0, Math.Min(1.0, dotProduct));
        }
    }
}
