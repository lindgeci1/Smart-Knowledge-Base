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

        public async Task<string> SummarizeWithOllama(string text)
        {
            Console.WriteLine($"[{DateTime.Now}] Starting summarization with Ollama (Docker)...");

            using var client = new HttpClient();
            var request = new
            {
                model = "llama3.2",
                prompt = $"Summarize this:\n{text}"
            };

            var json = System.Text.Json.JsonSerializer.Serialize(request);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            var response = await client.PostAsync("http://localhost:11434/api/generate", content);
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

            Console.WriteLine($"[{DateTime.Now}] Summarization completed.");
            return finalOutput.Trim();
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

