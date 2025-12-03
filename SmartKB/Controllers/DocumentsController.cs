using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using SmartKB.Services;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly IMongoCollection<Document> _documentCollection;

        public DocumentsController(IConfiguration configuration)
        {
            var client = new MongoClient(configuration["MongoDbSettings:ConnectionString"]);
            var database = client.GetDatabase(configuration["MongoDbSettings:DatabaseName"]);
            _documentCollection = database.GetCollection<Document>("documents");
        }

        [HttpGet("getall")]
        public IActionResult GetAllDocuments()
        {
            var documents = _documentCollection.Find(_ => true).ToList();

            var result = documents.Select(d => new DocumentDto
            {
                Id = d.Id,
                FileName = d.FileName,
                FileType = d.FileType,
                //Summary = d.Summary
            }).ToList();

            return Ok(result);
        }

        [HttpGet("{id}")]
        public IActionResult GetDocumentById(string id)
        {
            var document = _documentCollection.Find(d => d.Id == id).FirstOrDefault();
            if (document == null)
                return NotFound("Document not found");

            return Ok(document);
        }
        [HttpPost("upload")]
        public async Task<IActionResult> UploadDocument(IFormFile file)
        {
            // --- REQUIRED ---
            if (file == null || file.Length == 0)
                return BadRequest("File is required.");

            // --- ALLOWED TYPES (Excel added) ---
            var allowed = new[] { "pdf", "txt", "doc", "docx", "xls", "xlsx" };
            var fileExt = Path.GetExtension(file.FileName).TrimStart('.').ToLower();

            if (!allowed.Contains(fileExt))
                return BadRequest("Unsupported file type. Allowed: pdf, txt, doc, docx, xls, xlsx.");

            // --- SIZE LIMIT: 5 MB ---
            const long maxSize = 5 * 1024 * 1024; // 5MB
            if (file.Length > maxSize)
                return BadRequest("File too large. Max allowed is 5MB.");

            // --- READ FILE ---
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var fileBytes = ms.ToArray();

            var fileName = Path.GetFileNameWithoutExtension(file.FileName);
            var fileType = fileExt;

            // --- EXTRACT TEXT ---
            var extractor = new TextExtractor();
            string extractedText = extractor.ExtractText(fileBytes, fileType);

            var document = new Document
            {
                FileName = fileName,
                FileType = fileType,
                FileData = extractedText,
                Summary = null,
                Status = "Pending"
            };

            _documentCollection.InsertOne(document);
            Console.WriteLine($"[{DateTime.Now}] Document {document.Id} uploaded and text stored.");

            try
            {
                // Directly await AI summarization
                string summary = await SummarizeWithOllama(extractedText);

                var update = Builders<Document>.Update
                    .Set(d => d.Summary, summary)
                    .Set(d => d.Status, "Completed");

                _documentCollection.UpdateOne(d => d.Id == document.Id, update);

                Console.WriteLine($"[{DateTime.Now}] Document {document.Id} updated with summary.");

                // Return summary immediately
                return Ok(new
                {
                    message = "Document uploaded and summarized",
                    documentId = document.Id,
                    summary
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now}] Summarization failed for document {document.Id}: {ex.Message}");

                var update = Builders<Document>.Update
                    .Set(d => d.Status, "Error");

                _documentCollection.UpdateOne(d => d.Id == document.Id, update);

                return StatusCode(500, "Summarization failed");
            }
        }

        [HttpPost("add-text")]
        public async Task<IActionResult> AddTextDocument([FromBody] AddTextDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Text))
                return BadRequest("Text is required.");

            var document = new Document
            {
                FileName = "Untitled", 
                FileType = "text",
                FileData = dto.Text,
                Summary = null,
                Status = "Pending"
            };

            _documentCollection.InsertOne(document);

            try
            {
                string summary = await SummarizeWithOllama(dto.Text);

                var update = Builders<Document>.Update
                    .Set(d => d.Summary, summary)
                    .Set(d => d.Status, "Completed");

                _documentCollection.UpdateOne(d => d.Id == document.Id, update);

                return Ok(new
                {
                    message = "Text added and summarized",
                    documentId = document.Id,
                    summary
                });
            }
            catch
            {
                var update = Builders<Document>.Update.Set(d => d.Status, "Error");
                _documentCollection.UpdateOne(d => d.Id == document.Id, update);
                return StatusCode(500, "Summarization failed");
            }
        }

        private async Task<string> SummarizeWithOllama(string text)
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


    }
}
