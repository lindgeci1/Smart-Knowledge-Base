using System.Text;
using System.Text.Json;

namespace SmartKB.Services
{
    public class AiService
    {
        private readonly IConfiguration _configuration;

        public AiService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<string> ChatWithAi(string prompt)
        {
            var apiKey = Environment.GetEnvironmentVariable("OLLAMA_API_KEY");
            var ollamaModel = Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? _configuration["Ollama:Model"] ?? "llama3";
            
            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromMinutes(2);
            
            string requestUrl;
            string json;
            bool isCloud = !string.IsNullOrEmpty(apiKey);

            if (isCloud)
            {
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
                requestUrl = "https://ollama.com/api/chat";
                
                var request = new
                {
                    model = ollamaModel,
                    messages = new[]
                    {
                        new { role = "user", content = prompt }
                    },
                    stream = false
                };
                json = JsonSerializer.Serialize(request);
            }
            else
            {
                var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_BASE_URL") ?? _configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
                requestUrl = $"{ollamaUrl}/api/generate";
                
                var request = new { model = ollamaModel, prompt = prompt, stream = false };
                json = JsonSerializer.Serialize(request);
            }

            var content = new StringContent(json, Encoding.UTF8, "application/json");
            

            var response = await client.PostAsync(requestUrl, content);
            response.EnsureSuccessStatusCode();
            
            var responseString = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseString);
            
            string responseText;
            if (isCloud)
            {
                responseText = doc.RootElement.GetProperty("message").GetProperty("content").GetString() ?? "";
            }
            else
            {
                responseText = doc.RootElement.GetProperty("response").GetString() ?? "";
            }
            
            return responseText;
        }
    }
}