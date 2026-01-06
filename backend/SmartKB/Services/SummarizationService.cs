using MongoDB.Driver;
using SmartKB.Models;
using System.Net.Http;

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

        // Uses Docker if OLLAMA_URL is set, otherwise uses Cloud
        public async Task<string> SummarizeWithDockerOrCloud(string text, string type = "text")
        {
            var startTime = DateTime.UtcNow;
            var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_URL");
            var useDocker = !string.IsNullOrEmpty(ollamaUrl);
            
            Console.WriteLine($"Summarization {(useDocker ? "with Docker (local)" : "with Cloud")} started - {type}");

            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromMinutes(5);

            if (useDocker)
            {
                // Docker/Local mode - use /api/generate
                var request = new
                {
                    model = "llama3.2",
                    prompt = $"Create a concise summary of the following text (aim for about 30-40% of the original length). Divide it into major sections. For each section, use a clear header in CAPITAL LETTERS followed by the content. Add a blank line after each section. Do NOT use any markdown formatting (no **, __, *, _, ##, etc.). Use plain text only. Format like:\n\nSECTION NAME\nContent for this section...\n\nANOTHER SECTION\nContent for this section...\n\nText to summarize:\n{text}"
                };

                var json = System.Text.Json.JsonSerializer.Serialize(request);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

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
                Console.WriteLine($"Summarization with Docker (local) finished - Response time: {responseTime:F2} ms");

                return RemoveMarkdown(finalOutput.Trim());
            }
            else
            {
                // Cloud mode - use /api/chat
                var apiKey = Environment.GetEnvironmentVariable("OLLAMA_API_KEY");
                var model = Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? "gpt-oss:120b-cloud";
                
                if (string.IsNullOrEmpty(apiKey))
                {
                    throw new Exception("OLLAMA_API_KEY environment variable is not set.");
                }

                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
                
                var ollamaApiUrl = "https://ollama.com/api/chat";
                
                var request = new
                {
                    model = model,
                    messages = new[]
                    {
                        new { role = "user", content = $"Create a concise summary of the following text (aim for about 30-40% of the original length). Divide it into major sections. For each section, use a clear header in CAPITAL LETTERS followed by the content. Add a blank line after each section. Do NOT use any markdown formatting (no **, __, *, _, ##, etc.). Use plain text only. Format like:\n\nSECTION NAME\nContent for this section...\n\nANOTHER SECTION\nContent for this section...\n\nText to summarize:\n{text}" }
                    },
                    stream = false
                };

                var json = System.Text.Json.JsonSerializer.Serialize(request);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await client.PostAsync(ollamaApiUrl, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                var doc = System.Text.Json.JsonDocument.Parse(responseJson);
                var summary = doc.RootElement.GetProperty("message").GetProperty("content").GetString() ?? "";

                var endTime = DateTime.UtcNow;
                var responseTime = (endTime - startTime).TotalMilliseconds;
                Console.WriteLine($"Summarization with Cloud finished - Response time: {responseTime:F2} ms");

                return RemoveMarkdown(summary.Trim());
            }
        }

        // Uses Docker if OLLAMA_URL is set, otherwise uses Cloud
        public async Task<(string summary, string keyword)> SummarizeWithKeywordDockerOrCloud(string text, string type = "text")
        {
            var startTime = DateTime.UtcNow;
            var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_URL");
            var useDocker = !string.IsNullOrEmpty(ollamaUrl);
            
            Console.WriteLine($"Summarization with keyword extraction {(useDocker ? "with Docker (local)" : "with Cloud")} started - {type}");

            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromMinutes(5);

            if (useDocker)
            {
                // Docker/Local mode - use /api/generate
                var model = Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? "llama3.2";
                
                // First, get the summary
                var summaryRequest = new
                {
                    model = model,
                    prompt = $"Create a concise summary of the following text (aim for about 30-40% of the original length). Divide it into major sections. For each section, use a clear header in CAPITAL LETTERS followed by the content. Add a blank line after each section. Do NOT use any markdown formatting (no **, __, *, _, ##, etc.). Use plain text only. Format like:\n\nSECTION NAME\nContent for this section...\n\nANOTHER SECTION\nContent for this section...\n\nText to summarize:\n{text}"
                };

                var summaryJson = System.Text.Json.JsonSerializer.Serialize(summaryRequest);
                var summaryContent = new StringContent(summaryJson, System.Text.Encoding.UTF8, "application/json");

                var ollamaApiUrl = $"{ollamaUrl}/api/generate";
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
                    model = model,
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

                // Clean up the keyword
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
                Console.WriteLine($"Summarization with keyword extraction (Docker) finished - Response time: {responseTime:F2} ms - Keyword: {keyword}");

                return (RemoveMarkdown(summary.Trim()), keyword.Trim());
            }
            else
            {
                // Cloud mode - use /api/chat
                var apiKey = Environment.GetEnvironmentVariable("OLLAMA_API_KEY");
                var model = Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? "gpt-oss:120b-cloud";
                
                if (string.IsNullOrEmpty(apiKey))
                {
                    throw new Exception("OLLAMA_API_KEY environment variable is not set.");
                }

                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
                
                var ollamaApiUrl = "https://ollama.com/api/chat";
            
            // First, get the summary
            var summaryRequest = new
            {
                model = model,
                messages = new[]
                {
                    new { role = "user", content = $"Create a concise summary of the following text (aim for about 30-40% of the original length). Divide it into major sections. For each section, use a clear header in CAPITAL LETTERS followed by the content. Add a blank line after each section. Do NOT use any markdown formatting (no **, __, *, _, ##, etc.). Use plain text only. Format like:\n\nSECTION NAME\nContent for this section...\n\nANOTHER SECTION\nContent for this section...\n\nText to summarize:\n{text}" }
                },
                stream = false
            };

            var summaryJson = System.Text.Json.JsonSerializer.Serialize(summaryRequest);
            var summaryContent = new StringContent(summaryJson, System.Text.Encoding.UTF8, "application/json");

            HttpResponseMessage summaryResponse;
            try
            {
                summaryResponse = await client.PostAsync(ollamaApiUrl, summaryContent);
                summaryResponse.EnsureSuccessStatusCode();
            }
            catch (HttpRequestException ex)
            {
                throw new Exception($"Failed to connect to Ollama service: {ex.Message}", ex);
            }
            catch (TaskCanceledException ex)
            {
                throw new Exception($"Request timed out: {ex.Message}", ex);
            }

            var summaryResponseJson = await summaryResponse.Content.ReadAsStringAsync();
            var summaryDoc = System.Text.Json.JsonDocument.Parse(summaryResponseJson);
            var summary = summaryDoc.RootElement.GetProperty("message").GetProperty("content").GetString() ?? "";

            // Then, extract the main keyword/topic
            var keywordRequest = new
            {
                model = model,
                messages = new[]
                {
                    new { role = "user", content = $"Based on this text, identify the single most important keyword or topic (one word or short phrase, 1-3 words max) that best represents the main subject:\n{text}\n\nRespond with only the keyword/topic, nothing else." }
                },
                stream = false
            };

            var keywordJson = System.Text.Json.JsonSerializer.Serialize(keywordRequest);
            var keywordContent = new StringContent(keywordJson, System.Text.Encoding.UTF8, "application/json");

            HttpResponseMessage keywordResponse;
            try
            {
                keywordResponse = await client.PostAsync(ollamaApiUrl, keywordContent);
                keywordResponse.EnsureSuccessStatusCode();
            }
            catch (HttpRequestException ex)
            {
                throw new Exception($"Failed to connect to Ollama service for keyword extraction: {ex.Message}", ex);
            }
            catch (TaskCanceledException ex)
            {
                throw new Exception($"Request timed out: {ex.Message}", ex);
            }

            var keywordResponseJson = await keywordResponse.Content.ReadAsStringAsync();
            var keywordDoc = System.Text.Json.JsonDocument.Parse(keywordResponseJson);
            var keyword = keywordDoc.RootElement.GetProperty("message").GetProperty("content").GetString() ?? "";

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
                Console.WriteLine($"Summarization with keyword extraction (Cloud) finished - Response time: {responseTime:F2} ms - Keyword: {keyword}");

                return (RemoveMarkdown(summary.Trim()), keyword.Trim());
            }
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
        }}

        // Remove markdown formatting from text
        private string RemoveMarkdown(string text)
        {
            if (string.IsNullOrEmpty(text))
                return text;

            // Remove bold (**text** or __text__)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\*\*(.*?)\*\*", "$1");
            text = System.Text.RegularExpressions.Regex.Replace(text, @"__(.*?)__", "$1");

            // Remove italic (*text* or _text_)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\*(.*?)\*", "$1");
            text = System.Text.RegularExpressions.Regex.Replace(text, @"_(.*?)_", "$1");

            // Remove code blocks (```code``` or `code`)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"```(.*?)```", "$1", System.Text.RegularExpressions.RegexOptions.Singleline);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"`(.*?)`", "$1");

            // Remove headers (# Header)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"^#+\s+", "", System.Text.RegularExpressions.RegexOptions.Multiline);

            // Remove markdown table formatting (pipes and dashes)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\|.*?\|", m => 
            {
                // Remove pipes and extra spaces, keep the content
                return m.Value.Replace("|", "").Replace("---", "").Trim();
            });

            // Remove markdown links [text](url)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\[([^\]]+)\]\([^\)]+\)", "$1");

            // Remove horizontal rules (--- or ***)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"^(\-{3,}|\*{3,})$", "", System.Text.RegularExpressions.RegexOptions.Multiline);

            // Remove list markers (-, *, +)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"^\s*[\-\*\+]\s+", "", System.Text.RegularExpressions.RegexOptions.Multiline);

            // Clean up excessive whitespace
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\n\s*\n", "\n");
            text = System.Text.RegularExpressions.Regex.Replace(text, @"  +", " ");

            return text.Trim();
        }
    }
}

