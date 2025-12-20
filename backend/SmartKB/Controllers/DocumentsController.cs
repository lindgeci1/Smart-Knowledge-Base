using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using SmartKB.Services;
using System.Security.Cryptography;
using System.Text;
namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly IMongoCollection<Document> _documentCollection;
        private readonly IMongoCollection<TextDocument> _textCollection;
        private readonly IMongoCollection<User> _userCollection;
        private readonly IMongoCollection<Role> _roleCollection;
        private readonly IMongoCollection<UserRole> _userRoleCollection;
        public DocumentsController(IConfiguration configuration)
        {
            var client = new MongoClient(configuration["MongoDbSettings:ConnectionString"]);
            var database = client.GetDatabase(configuration["MongoDbSettings:DatabaseName"]);

            _documentCollection = database.GetCollection<Document>("documents");
            _textCollection = database.GetCollection<TextDocument>("texts");
            _userCollection = database.GetCollection<User>("users");
            _roleCollection = database.GetCollection<Role>("roles");
            _userRoleCollection = database.GetCollection<UserRole>("userRoles");
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
            
            // More robust file extension extraction that handles filenames with parentheses
            var originalFileName = file.FileName;
            var lastDotIndex = originalFileName.LastIndexOf('.');
            var fileExt = lastDotIndex >= 0 && lastDotIndex < originalFileName.Length - 1
                ? originalFileName.Substring(lastDotIndex + 1).ToLower()
                : Path.GetExtension(originalFileName).TrimStart('.').ToLower();

            if (string.IsNullOrWhiteSpace(fileExt) || !allowed.Contains(fileExt))
                return BadRequest("Unsupported file type. Allowed: pdf, txt, doc, docx, xls, xlsx.");

            
            const long maxSize = 5 * 1024 * 1024;
            if (file.Length > maxSize)
                return BadRequest("File too large. Max allowed is 5MB.");

            
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var fileBytes = ms.ToArray();

            var fileName = Path.GetFileNameWithoutExtension(originalFileName);
            var fileType = fileExt;

            // Extract text with error handling
            string extractedText;
            try
            {
                var extractor = new TextExtractor();
                extractedText = extractor.ExtractText(fileBytes, fileType);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

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
                UserId = userId,
                CreatedAt = DateTime.UtcNow
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
        [HttpGet("text-summaries")]
        public IActionResult GetTextSummaries()
        {
            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // Get all text summaries for this user, ordered by creation date (newest first)
            var summaries = _textCollection
                .Find(t => t.UserId == userId && t.Status == "Completed" && !string.IsNullOrEmpty(t.Summary))
                .SortByDescending(t => t.CreatedAt)
                .ToList();

            var result = summaries.Select(t => new
            {
                id = t.Id,
                text = t.Text,
                summary = t.Summary,
                createdAt = t.CreatedAt,
                status = t.Status
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("file-summaries")]
        public IActionResult GetFileSummaries()
        {
            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // Get all file summaries for this user, ordered by ID (newest first, since MongoDB ObjectId includes timestamp)
            var summaries = _documentCollection
                .Find(d => d.UserId == userId && d.Status == "Completed" && !string.IsNullOrEmpty(d.Summary))
                .SortByDescending(d => d.Id)
                .ToList();

            var result = summaries.Select(d => new
            {
                id = d.Id,
                fileName = d.FileName,
                fileType = d.FileType,
                summary = d.Summary,
                status = d.Status
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/total-users")]
        public async Task<IActionResult> GetTotalUsers()
        {
            var count = await _userCollection.CountDocumentsAsync(_ => true);
            return Ok(new { count = (int)count });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/documents")]
        public async Task<IActionResult> GetAllDocuments()
        {
            var documents = await _documentCollection
                .Find(d => d.Status == "Completed" && !string.IsNullOrEmpty(d.Summary))
                .SortByDescending(d => d.Id)
                .ToListAsync();

            var result = new List<object>();
            foreach (var doc in documents)
            {
                var user = await _userCollection.Find(u => u.UserId == doc.UserId).FirstOrDefaultAsync();
                result.Add(new
                {
                    id = doc.Id,
                    fileName = doc.FileName,
                    fileType = doc.FileType,
                    summary = doc.Summary,
                    userId = doc.UserId,
                    userEmail = user?.Email ?? "Unknown",
                    createdAt = doc.Id != null ? MongoDB.Bson.ObjectId.Parse(doc.Id).CreationTime.ToString("yyyy-MM-ddTHH:mm:ssZ") : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                });
            }

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpDelete("admin/document/{id}")]
        public async Task<IActionResult> DeleteDocument(string id)
        {
            var document = await _documentCollection.Find(d => d.Id == id).FirstOrDefaultAsync();
            if (document == null)
                return NotFound("Document not found");

            await _documentCollection.DeleteOneAsync(d => d.Id == id);
            return Ok(new { message = "Document deleted successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/text-summaries")]
        public async Task<IActionResult> GetAllTextSummaries()
        {
            var texts = await _textCollection
                .Find(t => t.Status == "Completed" && !string.IsNullOrEmpty(t.Summary))
                .SortByDescending(t => t.CreatedAt)
                .ToListAsync();

            var result = new List<object>();
            foreach (var text in texts)
            {
                var user = await _userCollection.Find(u => u.UserId == text.UserId).FirstOrDefaultAsync();
                result.Add(new
                {
                    id = text.Id,
                    text = text.Text,
                    summary = text.Summary,
                    userId = text.UserId,
                    userEmail = user?.Email ?? "Unknown",
                    createdAt = text.CreatedAt
                });
            }

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpDelete("admin/text-summary/{id}")]
        public async Task<IActionResult> DeleteTextSummary(string id)
        {
            var text = await _textCollection.Find(t => t.Id == id).FirstOrDefaultAsync();
            if (text == null)
                return NotFound("Text summary not found");

            await _textCollection.DeleteOneAsync(t => t.Id == id);
            return Ok(new { message = "Text summary deleted successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/users")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _userCollection.Find(_ => true).ToListAsync();

            var result = new List<object>();
            foreach (var user in users)
            {
                var userRole = await _userRoleCollection.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
                var roleId = userRole?.RoleId ?? 2;
                result.Add(new
                {
                    id = user.UserId,
                    name = user.Username,
                    email = user.Email,
                    role = roleId == 1 ? "admin" : "user",
                    status = user.IsActive ? "active" : "inactive",
                    joinedAt = user.CreatedAt
                });
            }

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpPost("admin/users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email))
                return BadRequest("Email is required");
            if (string.IsNullOrWhiteSpace(dto.Username))
                return BadRequest("Username is required");
            if (string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest("Password is required");

            var existing = await _userCollection.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
            if (existing != null)
                return BadRequest("Email already exists");

            var existingUsername = await _userCollection.Find(u => u.Username == dto.Username).FirstOrDefaultAsync();
            if (existingUsername != null)
                return BadRequest("Username already exists");

            var saltBytes = RandomNumberGenerator.GetBytes(16);
            var salt = Convert.ToBase64String(saltBytes);

            var hash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.Password + salt))
            );

            var user = new User
            {
                Email = dto.Email,
                Username = dto.Username,
                PasswordHash = hash,
                PasswordSalt = salt,
                IsActive = true,
                RefreshToken = null,
                RefreshTokenExpiresAt = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _userCollection.InsertOneAsync(user);

            // Assign role (default to user role = 2)
            int roleId = 2;
            var role = await _roleCollection.Find(r => r.RoleId == roleId).FirstOrDefaultAsync();
            if (role == null)
                return BadRequest("Role not found in DB: " + roleId);

            var userRole = new UserRole
            {
                UserId = user.UserId,
                RoleId = roleId
            };

            await _userRoleCollection.InsertOneAsync(userRole);

            return Ok(new
            {
                message = "User created successfully",
                userId = user.UserId
            });
        }

        [Authorize(Roles = "1")]
        [HttpDelete("admin/user/{id}")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            var user = await _userCollection.Find(u => u.UserId == id).FirstOrDefaultAsync();
            if (user == null)
                return NotFound("User not found");

            // Check if user is admin and prevent deletion
            var userRole = await _userRoleCollection.Find(ur => ur.UserId == id).FirstOrDefaultAsync();
            if (userRole != null && userRole.RoleId == 1)
                return BadRequest("Cannot delete admin users");

            // Delete user role associations
            await _userRoleCollection.DeleteManyAsync(ur => ur.UserId == id);

            // Delete user
            await _userCollection.DeleteOneAsync(u => u.UserId == id);

            return Ok(new { message = "User deleted successfully" });
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
