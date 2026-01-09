using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.Models;
using SmartKB.Services;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly IMongoCollection<Document> _documentCollection;
        private readonly IMongoCollection<User> _userCollection;
        private readonly IMongoCollection<UserRole> _userRoleCollection;
        private readonly IMongoCollection<Usage> _usageCollection;
        private readonly SummarizationService _summarizationService;
        private readonly EmbeddingService _embeddingService;
        private readonly IConfiguration _configuration;

        public DocumentsController(IConfiguration configuration, EmbeddingService embeddingService)
        {
            _configuration = configuration;
            _embeddingService = embeddingService;
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _documentCollection = database.GetCollection<Document>("documents");
            _userCollection = database.GetCollection<User>("users");
            _userRoleCollection = database.GetCollection<UserRole>("userRoles");
            _usageCollection = database.GetCollection<Usage>("usage");
            _summarizationService = new SummarizationService(_userRoleCollection, _usageCollection);
        }

        [AllowAnonymous]
        [HttpGet("count")]
        public async Task<IActionResult> GetDocumentsCount()
        {
            var count = await _documentCollection.CountDocumentsAsync(d => d.Status == "Completed" && !string.IsNullOrEmpty(d.Summary));
            return Ok(new { count = (int)count });
        }

        [Authorize(Roles = "1")]

        [HttpGet("{id}")]
        public IActionResult GetDocumentById(string id)
        {
            var document = _documentCollection.Find(d => d.DocumentId == id).FirstOrDefault();
            if (document == null)
                return NotFound("Document not found");

            return Ok(document);
        }
        [Authorize(Roles = "1, 2")]

        [HttpPost("upload")]
        public async Task<IActionResult> UploadDocument(IFormFile file, [FromForm] string? folderId = null)
        {
            if (file == null || file.Length == 0)
                return BadRequest("File is required.");

            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var folderCollection = _documentCollection.Database.GetCollection<Folder>("folders");

            // Folder optional: only validate if provided; otherwise keep null
            if (!string.IsNullOrWhiteSpace(folderId))
            {
                var folder = await folderCollection.Find(f => f.FolderId == folderId && f.UserId == userId).FirstOrDefaultAsync();
                if (folder == null)
                    return BadRequest("Folder not found or you don't have access");
            }

            // Check if user has reached their usage limit (only for regular users, not admins)
            var userRole = await _userRoleCollection.Find(ur => ur.UserId == userId).FirstOrDefaultAsync();
            if (userRole != null && userRole.RoleId == 2) // Role 2 is regular user
            {
                var usage = await _usageCollection.Find(u => u.UserId == userId).FirstOrDefaultAsync();
                if (usage != null && usage.OverallUsage >= usage.TotalLimit)
                {
                    return BadRequest("You have reached your usage limit. Please upgrade to continue generating summaries.");
                }
            }

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

            // Clean excessive spaces and normalize formatting
            var cleanedText = CleanExcessiveSpaces(extractedText);

            var document = new Document
            {
                FileName = fileName,
                FileType = fileType,
                FileData = cleanedText,
                Summary = null,
                Status = "Pending",
                UserId = userId,
                FolderId = string.IsNullOrWhiteSpace(folderId) ? null : folderId
            };

            _documentCollection.InsertOne(document);

            try
            {
                var (summary, keyword) = await _summarizationService.SummarizeWithKeywordDockerOrCloud(cleanedText, "file");
                var documentName = $"File Summary of {keyword}";

                // Generate embedding for the summary (required)
                float[]? embedding = null;
                if (!string.IsNullOrWhiteSpace(summary) && summary.Length >= 10)
                {
                    embedding = await _embeddingService.GenerateEmbeddingAsync(summary);
                }

                var update = Builders<Document>.Update
                    .Set(d => d.Summary, summary)
                    .Set(d => d.DocumentName, documentName)
                    .Set(d => d.Status, "Completed");

                // Always set embedding if it was generated (required for RAG)
                if (embedding != null)
                {
                    update = update.Set(d => d.Embedding, embedding);

                }
                else
                {

                }

                _documentCollection.UpdateOne(d => d.DocumentId == document.DocumentId, update);


                // Increment usage for regular users (role 2), not admins (role 1)
                await _summarizationService.IncrementUsageIfUser(userId);

                // Fetch the updated document to get the documentName
                var updatedDocument = await _documentCollection.Find(d => d.DocumentId == document.DocumentId).FirstOrDefaultAsync();

                return Ok(new
                {
                    message = "Document uploaded and summarized",
                    documentId = document.DocumentId,
                    summary,
                    documentName = updatedDocument?.DocumentName
                });
            }
            catch (Exception ex)
            {

                var update = Builders<Document>.Update
                    .Set(d => d.Status, "Error");

                _documentCollection.UpdateOne(d => d.DocumentId == document.DocumentId, update);

                return StatusCode(500, "Summarization failed");
            }
        }
        [Authorize(Roles = "1, 2")]
        [HttpGet("summaries")]
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
                .SortByDescending(d => d.DocumentId)
                .ToList();

            var result = summaries.Select(d => new
            {
                id = d.DocumentId,
                fileName = d.FileName,
                fileType = d.FileType,
                summary = d.Summary,
                documentName = d.DocumentName,
                status = d.Status,
                folderId = d.FolderId
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1, 2")]
        [HttpPatch("{id}")]
        public async Task<IActionResult> UpdateDocument(string id, [FromBody] dynamic updateData)
        {
            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // Verify document belongs to user
            var document = await _documentCollection.Find(d => d.DocumentId == id && d.UserId == userId).FirstOrDefaultAsync();
            if (document == null)
                return NotFound("Document not found");

            var updateDef = Builders<Document>.Update;
            var updates = new List<UpdateDefinition<Document>>();

            // Handle folderId update safely (JsonElement or POCO)
            try
            {
                string? folderId = null;

                if (updateData is System.Text.Json.JsonElement element)
                {
                    if (element.TryGetProperty("folderId", out var prop) && prop.ValueKind != System.Text.Json.JsonValueKind.Undefined && prop.ValueKind != System.Text.Json.JsonValueKind.Null)
                    {
                        folderId = prop.GetString();
                    }
                }
                else if (((IDictionary<string, object>)updateData).ContainsKey("folderId"))
                {
                    folderId = (string?)updateData.folderId;
                }

                if (folderId != null)
                {
                    if (!string.IsNullOrWhiteSpace(folderId))
                    {
                        var folderCollection = _documentCollection.Database.GetCollection<Folder>("folders");
                        var folder = await folderCollection.Find(f => f.FolderId == folderId && f.UserId == userId).FirstOrDefaultAsync();
                        if (folder == null)
                            return BadRequest("Folder not found or you don't have access");
                    }

                    updates.Add(updateDef.Set(d => d.FolderId, folderId));
                }
            }
            catch
            {
                return BadRequest("Invalid request body");
            }

            if (updates.Count > 0)
            {
                var combined = updateDef.Combine(updates);
                await _documentCollection.UpdateOneAsync(d => d.DocumentId == id, combined);
            }

            return Ok(new { message = "Document updated successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/count")]
        public async Task<IActionResult> GetFileSummariesCount()
        {
            var count = await _documentCollection.CountDocumentsAsync(d => d.Status == "Completed" && !string.IsNullOrEmpty(d.Summary));
            return Ok(new { count = (int)count });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin")]
        public async Task<IActionResult> GetAllDocuments()
        {
            var documents = await _documentCollection
                .Find(d => d.Status == "Completed" && !string.IsNullOrEmpty(d.Summary))
                .SortByDescending(d => d.DocumentId)
                .ToListAsync();

            var result = new List<object>();
            foreach (var doc in documents)
            {
                var user = await _userCollection.Find(u => u.UserId == doc.UserId).FirstOrDefaultAsync();
                result.Add(new
                {
                    id = doc.DocumentId,
                    fileName = doc.FileName,
                    fileType = doc.FileType,
                    summary = doc.Summary,
                    documentName = doc.DocumentName,
                    userId = doc.UserId,
                    userEmail = user?.Email ?? "Unknown",
                    createdAt = doc.DocumentId != null ? MongoDB.Bson.ObjectId.Parse(doc.DocumentId).CreationTime.ToString("yyyy-MM-ddTHH:mm:ssZ") : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                });
            }

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpDelete("admin/{id}")]
        public async Task<IActionResult> DeleteDocument(string id)
        {
            var document = await _documentCollection.Find(d => d.DocumentId == id).FirstOrDefaultAsync();
            if (document == null)
                return NotFound("Document not found");

            await _documentCollection.DeleteOneAsync(d => d.DocumentId == id);
            return Ok(new { message = "Document deleted successfully" });
        }

        [Authorize(Roles = "1, 2")]
        [HttpDelete("bulk")]
        public async Task<IActionResult> DeleteDocumentsBulk([FromBody] List<string> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided");

            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // For regular users, only allow deleting their own documents
            var userRole = await _userRoleCollection.Find(ur => ur.UserId == userId).FirstOrDefaultAsync();
            if (userRole != null && userRole.RoleId == 2) // Role 2 is regular user
            {
                var result = await _documentCollection.DeleteManyAsync(d => ids.Contains(d.DocumentId) && d.UserId == userId);
                return Ok(new { message = "Documents deleted successfully", deletedCount = result.DeletedCount });
            }
            else // Admin can delete any
            {
                var result = await _documentCollection.DeleteManyAsync(d => ids.Contains(d.DocumentId));
                return Ok(new { message = "Documents deleted successfully", deletedCount = result.DeletedCount });
            }
        }

        private string CleanExcessiveSpaces(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return string.Empty;

            // Normalize line endings and whitespace variants
            text = text.Replace('\u00A0', ' '); // non-breaking spaces
            text = text.Replace("\r\n", "\n").Replace("\r", "\n");

            // Collapse all whitespace (spaces, tabs, newlines) to a single space to form one paragraph
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ");

            return text.Trim();
        }
    }
}
