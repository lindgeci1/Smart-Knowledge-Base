using MongoDB.Driver;
using SmartKB.Models;

namespace SmartKB.Services
{
    public class SummarizationService
    {
        private readonly IMongoCollection<UserRole> _userRoleCollection;
        private readonly IMongoCollection<Usage> _usageCollection;

        public SummarizationService(IMongoCollection<UserRole> userRoleCollection, IMongoCollection<Usage> usageCollection)
        {
            _userRoleCollection = userRoleCollection;
            _usageCollection = usageCollection;
        }

        public async Task<string> SummarizeWithOllama(string text, string type = "text")
        {
            var startTime = DateTime.UtcNow;
            Console.WriteLine($"Summarization with Ollama (Docker) started - {type}");

            using var client = new HttpClient();
            var request = new
            {
                model = "llama3.2",
                prompt = $"Summarize this:\n{text}"
            };

            var json = System.Text.Json.JsonSerializer.Serialize(request);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_URL") ?? "http://ollama:11434";
            var ollamaApiUrl = $"{ollamaUrl}/api/generate";
            var response = await client.PostAsync(ollamaApiUrl, content);
            response.EnsureSuccessStatusCode();

            var stream = await response.Content.ReadAsStreamAsync();
            using var reader = new StreamReader(stream);

            string finalOutput = "";
            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (string.IsNullOrWhiteSpace(line)) continue;

                var doc = System.Text.Json.JsonDocument.Parse(line);
                if (doc.RootElement.TryGetProperty("response", out var resp))
                    finalOutput += resp.GetString();
            }

            var endTime = DateTime.UtcNow;
            var responseTime = (endTime - startTime).TotalMilliseconds;
            Console.WriteLine($"Summarization with Ollama (Docker) finished - Response time: {responseTime:F2} ms");

            return finalOutput.Trim();
        }

        public async Task<(string summary, string keyword)> SummarizeWithKeyword(string text, string type = "text")
        {
            var startTime = DateTime.UtcNow;
            Console.WriteLine($"Summarization with keyword extraction started - {type}");

            var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_URL") ?? "http://ollama:11434";
            var ollamaApiUrl = $"{ollamaUrl}/api/generate";

            using var client = new HttpClient();
            
            // First, get the summary
            var summaryRequest = new
            {
                model = "llama3.2",
                prompt = $"Summarize this:\n{text}"
            };

            var summaryJson = System.Text.Json.JsonSerializer.Serialize(summaryRequest);
            var summaryContent = new StringContent(summaryJson, System.Text.Encoding.UTF8, "application/json");

            var summaryResponse = await client.PostAsync(ollamaApiUrl, summaryContent);
            summaryResponse.EnsureSuccessStatusCode();

            var summaryStream = await summaryResponse.Content.ReadAsStreamAsync();
            using var summaryReader = new StreamReader(summaryStream);

            string summary = "";
            while (!summaryReader.EndOfStream)
            {
                var line = await summaryReader.ReadLineAsync();
                if (string.IsNullOrWhiteSpace(line)) continue;

                var doc = System.Text.Json.JsonDocument.Parse(line);
                if (doc.RootElement.TryGetProperty("response", out var resp))
                    summary += resp.GetString();
            }

            // Then, extract the main keyword/topic
            var keywordRequest = new
            {
                model = "llama3.2",
                prompt = $"Based on this text, identify the single most important keyword or topic (one word or short phrase, 1-3 words max) that best represents the main subject:\n{text}\n\nRespond with only the keyword/topic, nothing else."
            };

            var keywordJson = System.Text.Json.JsonSerializer.Serialize(keywordRequest);
            var keywordContent = new StringContent(keywordJson, System.Text.Encoding.UTF8, "application/json");

            var keywordResponse = await client.PostAsync(ollamaApiUrl, keywordContent);
            keywordResponse.EnsureSuccessStatusCode();

            var keywordStream = await keywordResponse.Content.ReadAsStreamAsync();
            using var keywordReader = new StreamReader(keywordStream);

            string keyword = "";
            while (!keywordReader.EndOfStream)
            {
                var line = await keywordReader.ReadLineAsync();
                if (string.IsNullOrWhiteSpace(line)) continue;

                var doc = System.Text.Json.JsonDocument.Parse(line);
                if (doc.RootElement.TryGetProperty("response", out var resp))
                    keyword += resp.GetString();
            }

            // Clean up the keyword - remove quotes, extra whitespace, and limit length
            keyword = keyword.Trim().Trim('"', '\'', '.', ',', '!', '?');
            if (keyword.Length > 30)
            {
                keyword = keyword.Substring(0, 30).Trim();
            }
            if (string.IsNullOrWhiteSpace(keyword))
            {
                keyword = "Content";
            }

            var endTime = DateTime.UtcNow;
            var responseTime = (endTime - startTime).TotalMilliseconds;
            Console.WriteLine($"Summarization with keyword extraction finished - Response time: {responseTime:F2} ms - Keyword: {keyword}");

            return (summary.Trim(), keyword.Trim());
        }

        public async Task IncrementUsageIfUser(string userId)
        {
            // Check if user is a regular user (role 2), not admin (role 1)
            var userRole = await _userRoleCollection.Find(ur => ur.UserId == userId).FirstOrDefaultAsync();
            if (userRole == null || userRole.RoleId != 2) // Role 2 is user, Role 1 is admin
                return; // Don't increment usage for admins

            // Find or create usage record
            var usage = await _usageCollection.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            
            if (usage == null)
            {
                // Create new usage record with default limit of 100
                usage = new Usage
                {
                    UserId = userId,
                    OverallUsage = 10,
                    TotalLimit = 100,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _usageCollection.InsertOneAsync(usage);
            }
            else
            {
                // Increment usage by 10
                var update = Builders<Usage>.Update
                    .Inc(u => u.OverallUsage, 10)
                    .Set(u => u.UpdatedAt, DateTime.UtcNow);
                await _usageCollection.UpdateOneAsync(u => u.UserId == userId, update);
            }
        }
    }
}

