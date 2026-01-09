using System.Text;
using System.Text.Json;

namespace SmartKB.Services
{
    /// <summary>
    /// Generates embeddings using LOCAL Python service (sentence-transformers)
    /// NO external APIs, NO API keys needed, FREE - same as Python project
    /// </summary>
    public class EmbeddingService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly string _pythonServiceUrl;

        public EmbeddingService(IConfiguration configuration)
        {
            _configuration = configuration;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromMinutes(2);
            
            // Get Python service URL from env (default: localhost for local, http://localhost:5000 for container)
            _pythonServiceUrl = Environment.GetEnvironmentVariable("PYTHON_SERVICE_URL") 
                ?? "http://localhost:5000";
        }

        /// <summary>
        /// Generates an embedding vector from text using LOCAL Python service (NO API CALLS, NO KEYS NEEDED)
        /// Uses sentence-transformers library - same as Python project
        /// </summary>
        /// <param name="text">Text to embed (should be at least 10 characters)</param>
        /// <returns>Array of floats representing the embedding vector</returns>
        /// <exception cref="ArgumentException">Thrown when text is invalid</exception>
        /// <exception cref="Exception">Thrown when Python service call fails</exception>
        public async Task<float[]> GenerateEmbeddingAsync(string text)
        {
            if (string.IsNullOrWhiteSpace(text) || text.Length < 10)
            {
                throw new ArgumentException("Text must be at least 10 characters to generate meaningful embedding");
            }

            try
            {
                var request = new
                {
                    text = text
                };

                var json = JsonSerializer.Serialize(request);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                
                var response = await _httpClient.PostAsync($"{_pythonServiceUrl}/embed", content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"[EmbeddingService] ❌ Python service error: {response.StatusCode} - {errorContent}");
                    throw new Exception($"Failed to generate embedding: {response.StatusCode} - {errorContent}");
                }

                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);

                if (doc.RootElement.TryGetProperty("embedding", out var embeddingElement))
                {
                    var embeddingArray = embeddingElement
                        .EnumerateArray()
                        .Select(x => (float)x.GetDouble())
                        .ToArray();

                    var dimensions = doc.RootElement.TryGetProperty("dimensions", out var dimElement) 
                        ? dimElement.GetInt32() 
                        : embeddingArray.Length;
                    
                    return embeddingArray;
                }

                throw new Exception($"Unexpected Python service response format: {doc.RootElement}");
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"[EmbeddingService] ❌ Failed to connect to Python service at {_pythonServiceUrl}. Make sure Python service is running.");
                throw new Exception($"Python embedding service not available at {_pythonServiceUrl}. Error: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmbeddingService] ❌ Error calling Python service: {ex.Message}");
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
