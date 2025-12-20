using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
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
        private readonly IMongoCollection<TextDocument> _textCollection;
        private readonly IMongoCollection<User> _usersCollection;
        private readonly IConfiguration _configuration;
        public DocumentsController(IConfiguration configuration)
        {
            _configuration = configuration;
            var client = new MongoClient(configuration["MongoDbSettings:ConnectionString"]);
            var database = client.GetDatabase(configuration["MongoDbSettings:DatabaseName"]);

            _documentCollection = database.GetCollection<Document>("documents");
            _textCollection = database.GetCollection<TextDocument>("texts");
            _usersCollection = database.GetCollection<User>("users");
        }
        [Authorize(Roles = "1, 2")]

        [HttpGet("getall")]
        public IActionResult GetAllDocuments()
        {
            var documents = _documentCollection.Find(_ => true).ToList();

            var result = documents.Select(d => new DocumentDto
            {
                Id = d.Id,
                FileName = d.FileName,
                FileType = d.FileType,
                
            }).ToList();

            return Ok(result);
        }
        [Authorize(Roles = "1")]

        [HttpGet("{id}")]
        public IActionResult GetDocumentById(string id)
        {
            var document = _documentCollection.Find(d => d.Id == id).FirstOrDefault();
            if (document == null)
                return NotFound("Document not found");

            return Ok(document);
        }
        [Authorize(Roles = "1, 2")]

        [HttpPost("upload")]
        public async Task<IActionResult> UploadDocument(IFormFile file)
        {
            
            if (file == null || file.Length == 0)
                return BadRequest("File is required.");

            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var allowed = new[] { "pdf", "txt", "doc", "docx", "xls", "xlsx" };
            var fileExt = Path.GetExtension(file.FileName).TrimStart('.').ToLower();

            if (!allowed.Contains(fileExt))
                return BadRequest("Unsupported file type. Allowed: pdf, txt, doc, docx, xls, xlsx.");

            
            const long maxSize = 5 * 1024 * 1024;
            if (file.Length > maxSize)
                return BadRequest("File too large. Max allowed is 5MB.");

            
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var fileBytes = ms.ToArray();

            var fileName = Path.GetFileNameWithoutExtension(file.FileName);
            var fileType = fileExt;

            
            var extractor = new TextExtractor();
            string extractedText = extractor.ExtractText(fileBytes, fileType);

            var document = new Document
            {
                FileName = fileName,
                FileType = fileType,
                FileData = extractedText,
                Summary = null,
                Status = "Pending",
                UserId = userId
            };

            _documentCollection.InsertOne(document);
            Console.WriteLine($"[{DateTime.Now}] Document {document.Id} uploaded and text stored.");

            try
            {
                
                string summary = await SummarizeWithOllama(extractedText);

                var update = Builders<Document>.Update
                    .Set(d => d.Summary, summary)
                    .Set(d => d.Status, "Completed");

                _documentCollection.UpdateOne(d => d.Id == document.Id, update);

                Console.WriteLine($"[{DateTime.Now}] Document {document.Id} updated with summary.");

                
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
        [Authorize(Roles = "1, 2")]
        [HttpPost("add-text")]
        public async Task<IActionResult> AddTextDocument([FromBody] AddTextDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Text))
                return BadRequest("Text is required.");

            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var textDocument = new TextDocument
            {
                Text = dto.Text,
                Summary = null,
                Status = "Pending",
                UserId = userId
            };

            _textCollection.InsertOne(textDocument);

            try
            {
                string summary = await SummarizeWithOllama(dto.Text);

                var update = Builders<TextDocument>.Update
                    .Set(t => t.Summary, summary)
                    .Set(t => t.Status, "Completed");

                _textCollection.UpdateOne(t => t.Id == textDocument.Id, update);

                return Ok(new
                {
                    message = "Text added and summarized",
                    documentId = textDocument.Id,
                    summary
                });
            }
            catch
            {
                var update = Builders<TextDocument>.Update
                    .Set(t => t.Status, "Error");

                _textCollection.UpdateOne(t => t.Id == textDocument.Id, update);

                return StatusCode(500, "Summarization failed");
            }
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("my-documents")]
        public IActionResult GetMyDocuments()
        {
            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var documents = _documentCollection.Find(d => d.UserId == userId).ToList();

            var result = documents.Select(d => new
            {
                id = d.Id,
                userId = d.UserId,
                type = "file",
                content = d.FileName,
                filename = d.FileName + "." + d.FileType,
                summary = d.Summary ?? "",
                createdAt = d.Id != null ? ObjectId.Parse(d.Id).CreationTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                status = d.Status
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("my-texts")]
        public IActionResult GetMyTexts()
        {
            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var texts = _textCollection.Find(t => t.UserId == userId).ToList();

            var result = texts.Select(t => new
            {
                id = t.Id,
                userId = t.UserId,
                type = "text",
                content = t.Text.Length > 50 ? t.Text.Substring(0, 50) + "..." : t.Text,
                summary = t.Summary ?? "",
                createdAt = t.Id != null ? ObjectId.Parse(t.Id).CreationTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                status = t.Status
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpGet("all-documents")]
        public IActionResult GetAllDocumentsForAdmin()
        {
            var documents = _documentCollection.Find(_ => true).ToList();

            var result = documents.Select(d => new
            {
                id = d.Id,
                userId = d.UserId,
                type = "file",
                content = d.FileName,
                filename = d.FileName + "." + d.FileType,
                summary = d.Summary ?? "",
                createdAt = d.Id != null ? ObjectId.Parse(d.Id).CreationTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                status = d.Status
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpGet("all-texts")]
        public IActionResult GetAllTextsForAdmin()
        {
            var texts = _textCollection.Find(_ => true).ToList();

            var result = texts.Select(t => new
            {
                id = t.Id,
                userId = t.UserId,
                type = "text",
                content = t.Text.Length > 50 ? t.Text.Substring(0, 50) + "..." : t.Text,
                summary = t.Summary ?? "",
                createdAt = t.Id != null ? ObjectId.Parse(t.Id).CreationTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                status = t.Status
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpPut("document/{id}")]
        public IActionResult UpdateDocument(string id, [FromBody] UpdateDocumentDto dto)
        {
            var document = _documentCollection.Find(d => d.Id == id).FirstOrDefault();
            if (document == null)
                return NotFound("Document not found");

            var update = Builders<Document>.Update
                .Set(d => d.Summary, dto.Summary);

            _documentCollection.UpdateOne(d => d.Id == id, update);

            return Ok(new { message = "Document updated successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpDelete("document/{id}")]
        public IActionResult DeleteDocument(string id)
        {
            var document = _documentCollection.Find(d => d.Id == id).FirstOrDefault();
            if (document == null)
                return NotFound("Document not found");

            _documentCollection.DeleteOne(d => d.Id == id);

            return Ok(new { message = "Document deleted successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpPut("text/{id}")]
        public IActionResult UpdateText(string id, [FromBody] UpdateTextDto dto)
        {
            var text = _textCollection.Find(t => t.Id == id).FirstOrDefault();
            if (text == null)
                return NotFound("Text document not found");

            var update = Builders<TextDocument>.Update
                .Set(t => t.Summary, dto.Summary)
                .Set(t => t.Text, dto.Text);

            _textCollection.UpdateOne(t => t.Id == id, update);

            return Ok(new { message = "Text document updated successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpDelete("text/{id}")]
        public IActionResult DeleteText(string id)
        {
            var text = _textCollection.Find(t => t.Id == id).FirstOrDefault();
            if (text == null)
                return NotFound("Text document not found");

            _textCollection.DeleteOne(t => t.Id == id);

            return Ok(new { message = "Text document deleted successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpGet("stats")]
        public IActionResult GetStats()
        {
            var totalDocuments = _documentCollection.CountDocuments(_ => true);
            var totalTexts = _textCollection.CountDocuments(_ => true);
            var totalSummaries = totalDocuments + totalTexts;
            var totalUsers = _usersCollection.CountDocuments(_ => true);

            return Ok(new
            {
                totalUsers = (int)totalUsers,
                totalSummaries = (int)totalSummaries,
                totalFiles = (int)totalDocuments,
                totalTexts = (int)totalTexts
            });
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
