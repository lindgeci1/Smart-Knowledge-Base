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

        // Summarize using Ollama Cloud
        public async Task<string> SummarizeWithOllama(string text, string type = "text")
        {
            var startTime = DateTime.UtcNow;
            var apiKey = Environment.GetEnvironmentVariable("OLLAMA_API_KEY");
            var model = Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? "gpt-oss:120b-cloud";
            var preparedText = PrepareTextForModel(text);
            
            if (string.IsNullOrEmpty(apiKey))
            {
                throw new Exception("OLLAMA_API_KEY environment variable is not set.");
            }

            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromMinutes(5);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            // Optional attribution headers recommended by OpenRouter (leaderboards/routing)
            var referer = Environment.GetEnvironmentVariable("OPENROUTER_SITE_URL");
            var title = Environment.GetEnvironmentVariable("OPENROUTER_SITE_NAME");
            if (!string.IsNullOrWhiteSpace(referer))
            {
                client.DefaultRequestHeaders.Add("HTTP-Referer", referer);
            }
            if (!string.IsNullOrWhiteSpace(title))
            {
                client.DefaultRequestHeaders.Add("X-Title", title);
            }
            
            var ollamaApiUrl = "https://ollama.com/api/chat";
            
            var request = new
            {
                model = model,
                messages = new[]
                {
                    new { role = "user", content = $@"CRITICAL: The summary MUST ALWAYS be written in English, regardless of the source language. If the source text is in Albanian, Spanish, French, or any other language, you MUST translate the entire summary to English. The summary output must be 100% in English.

Create a concise summary of the following text (aim for about 30-40% of the original length). 
Divide it into major sections. 
For each section, use a clear header in CAPITAL LETTERS followed by the content. 
IMPORTANT: Add TWO blank lines after each section for proper spacing. 

DO NOT use any markdown formatting:
- No bold (**text** or __text__)
- No italic (*text* or _text_)
- No code blocks (```code``` or `code`)
- No headers (# Header)
- No links ([text](url))
- No lists (-, *, +, or numbered lists)
- No tables (| pipes)
- No checkboxes ([ ] or [x])
- No horizontal rules (--- or ***)
- No strikethrough (~~text~~)

DO NOT use special Unicode characters:
- No em dashes, en dashes, or special dashes
- No smart quotes or special quotes
- No special punctuation marks
- No zero-width characters or hidden formatting

Use ONLY:
- Plain regular hyphens (-)
- Regular apostrophes (')
- Regular quotes ("")
- Standard ASCII characters
- Plain text only

Format like:

SECTION NAME
Content for this section...


ANOTHER SECTION
Content for this section...


Text to summarize:
{preparedText}" }
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
            var responseTime = (endTime - startTime).TotalSeconds;

            return RemoveMarkdown(summary.Trim());
        }

        // Summarize using OpenRouter with keyword extraction
        public async Task<(string summary, string keyword)> SummarizeWithKeywordOllama(string text, string type = "text")
        {
            var startTime = DateTime.UtcNow;
            var apiKey = Environment.GetEnvironmentVariable("OPENROUTER_API_KEY");
            var model = Environment.GetEnvironmentVariable("OPENROUTER_MODEL") ?? "google/gemini-2.0-flash-exp:free";
            
            if (string.IsNullOrEmpty(apiKey))
            {
                throw new Exception("OPENROUTER_API_KEY environment variable is not set.");
            }
            
            if (string.IsNullOrEmpty(model))
            {
                throw new Exception("OPENROUTER_MODEL environment variable is not set.");
            }

            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromMinutes(5);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            // Optional attribution headers recommended by OpenRouter (leaderboards/routing)
            var referer = Environment.GetEnvironmentVariable("OPENROUTER_SITE_URL");
            var title = Environment.GetEnvironmentVariable("OPENROUTER_SITE_NAME");
            if (!string.IsNullOrWhiteSpace(referer))
            {
                client.DefaultRequestHeaders.Add("HTTP-Referer", referer);
            }
            if (!string.IsNullOrWhiteSpace(title))
            {
                client.DefaultRequestHeaders.Add("X-Title", title);
            }
            
            var openRouterApiUrl = "https://openrouter.ai/api/v1/chat/completions";
        
            // First, get the summary
            var preparedText = PrepareTextForModel(text);

            var summaryRequest = new
            {
                model = model,
                max_tokens = 800,
                temperature = 0.2,
                messages = new[]
                {
                    new { role = "user", content = $@"CRITICAL: The summary MUST ALWAYS be written in English, regardless of the source language. If the source text is in Albanian, Spanish, French, or any other language, you MUST translate the entire summary to English. The summary output must be 100% in English.

Create a concise summary of the following text (aim for about 30-40% of the original length). 
Divide it into major sections. 
For each section, use a clear header in CAPITAL LETTERS followed by the content. 
Add a blank line after each section. 

DO NOT use any markdown formatting:
- No bold (**text** or __text__)
- No italic (*text* or _text_)
- No code blocks (```code``` or `code`)
- No headers (# Header)
- No links ([text](url))
- No lists (-, *, +, or numbered lists)
- No tables (| pipes)
- No checkboxes ([ ] or [x])
- No horizontal rules (--- or ***)
- No strikethrough (~~text~~)

DO NOT use special Unicode characters:
- No em dashes, en dashes, or special dashes
- No smart quotes or special quotes
- No special punctuation marks
- No zero-width characters or hidden formatting

Use ONLY:
- Plain regular hyphens (-)
- Regular apostrophes (')
- Regular quotes ("")
- Standard ASCII characters
- Plain text only

Format like:

SECTION NAME
Content for this section...

ANOTHER SECTION
Content for this section...

Text to summarize:
{preparedText}" }
                },
                stream = false
            };

            var summaryJson = System.Text.Json.JsonSerializer.Serialize(summaryRequest);
            var summaryContent = new StringContent(summaryJson, System.Text.Encoding.UTF8, "application/json");

            HttpResponseMessage summaryResponse;
            try
            {
                summaryResponse = await client.PostAsync(openRouterApiUrl, summaryContent);
            }
            catch (HttpRequestException ex)
            {
                throw new Exception($"Failed to connect to OpenRouter service: {ex.Message}", ex);
            }
            catch (TaskCanceledException ex)
            {
                throw new Exception($"Request timed out: {ex.Message}", ex);
            }

            var summaryResponseJson = await summaryResponse.Content.ReadAsStringAsync();
            if (!summaryResponse.IsSuccessStatusCode)
            {
                throw new Exception($"OpenRouter summary failed: {(int)summaryResponse.StatusCode} {summaryResponse.StatusCode} - {summaryResponseJson}");
            }

            var summaryDoc = System.Text.Json.JsonDocument.Parse(summaryResponseJson);
            var summary = summaryDoc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "";

            // Then, extract the main keyword/topic
            var keywordRequest = new
            {
                model = model,
                max_tokens = 32,
                temperature = 0.1,
                messages = new[]
                {
                    new { role = "user", content = $"Based on this text, identify the single most important keyword or topic (one word or short phrase, 1-3 words max) that best represents the main subject:\n{preparedText}\n\nRespond with only the keyword/topic, nothing else." }
                },
                stream = false
            };

            var keywordJson = System.Text.Json.JsonSerializer.Serialize(keywordRequest);
            var keywordContent = new StringContent(keywordJson, System.Text.Encoding.UTF8, "application/json");

            HttpResponseMessage keywordResponse;
            try
            {
                keywordResponse = await client.PostAsync(openRouterApiUrl, keywordContent);
            }
            catch (HttpRequestException ex)
            {
                throw new Exception($"Failed to connect to OpenRouter service for keyword extraction: {ex.Message}", ex);
            }
            catch (TaskCanceledException ex)
            {
                throw new Exception($"Request timed out: {ex.Message}", ex);
            }

            var keywordResponseJson = await keywordResponse.Content.ReadAsStringAsync();
            if (!keywordResponse.IsSuccessStatusCode)
            {
                throw new Exception($"OpenRouter keyword failed: {(int)keywordResponse.StatusCode} {keywordResponse.StatusCode} - {keywordResponseJson}");
            }

            var keywordDoc = System.Text.Json.JsonDocument.Parse(keywordResponseJson);
            var keyword = keywordDoc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "";

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
            var responseTime = (endTime - startTime).TotalSeconds;

            return (RemoveMarkdown(summary.Trim()), keyword.Trim());
        }

        private string PrepareTextForModel(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return string.Empty;

            const int maxChars = 32000;
            if (text.Length <= maxChars)
                return text;

            var half = maxChars / 2;
            var head = text.Substring(0, half);
            var tail = text.Substring(text.Length - half, half);
            return $"{head}\n\n...TRUNCATED...\n\n{tail}";
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

            // Clean up excessive whitespace but preserve double blank lines (section spacing)
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\n\s*\n\s*\n\s*\n+", "\n\n\n");
            text = System.Text.RegularExpressions.Regex.Replace(text, @"  +", " ");

            return text.Trim();
        }
    }
}

