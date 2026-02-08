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
    [Route("api/Texts")]
    public class TextController : ControllerBase
    {
        private readonly IMongoCollection<Text> _textCollection;
        private readonly IMongoCollection<TextChunk> _textChunkCollection;
        private readonly IMongoCollection<User> _userCollection;
        private readonly IMongoCollection<UserRole> _userRoleCollection;
        private readonly IMongoCollection<Usage> _usageCollection;
        private readonly SummarizationService _summarizationService;
        private readonly EmbeddingService _embeddingService;
        private readonly IConfiguration _configuration;

        public TextController(IConfiguration configuration, EmbeddingService embeddingService)
        {
            _configuration = configuration;
            _embeddingService = embeddingService;
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _textCollection = database.GetCollection<Text>("texts");
            _textChunkCollection = database.GetCollection<TextChunk>("text_chunks");
            _userCollection = database.GetCollection<User>("users");
            _userRoleCollection = database.GetCollection<UserRole>("userRoles");
            _usageCollection = database.GetCollection<Usage>("usage");
            _summarizationService = new SummarizationService(_userRoleCollection, _usageCollection);
        }

        [AllowAnonymous]
        [HttpGet("count")]
        public async Task<IActionResult> GetTextSummariesCount()
        {
            var count = await _textCollection.CountDocumentsAsync(t =>
                t.Status == "Completed" &&
                !string.IsNullOrEmpty(t.Summary) &&
                !t.IsDeleted
            );
            return Ok(new { count = (int)count });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPost]
        public async Task<IActionResult> AddTextDocument([FromBody] AddTextDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Text))
                return BadRequest("Text is required.");

            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var folderCollection = _textCollection.Database.GetCollection<Folder>("folders");

            // Folder optional: only validate if provided; otherwise keep null
            string? folderId = dto.FolderId;
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

            // Clean excessive spaces and format text
            var cleanedText = CleanExcessiveSpaces(dto.Text);

            var text = new Text
            {
                TextContent = cleanedText,
                TextName = null,
                Summary = string.Empty,
                Status = "Pending",
                UserId = userId,
                FolderId = string.IsNullOrWhiteSpace(folderId) ? null : folderId,
                CreatedAt = DateTime.UtcNow
            };

            _textCollection.InsertOne(text);

            try
            {
                // ---------------------------------------
                // Chunking + embeddings (chunk-based RAG)
                // ---------------------------------------
                if (string.IsNullOrWhiteSpace(text.TextId))
                {
                    throw new Exception("TextId not generated after insert.");
                }

                var chunkSize = GetEnvInt("RAG_CHUNK_SIZE", 1000, 200, 4000);
                var chunks = SplitTextIntoChunks(cleanedText, chunkSize);
                var chunkDocs = new List<TextChunk>(chunks.Count);

                for (var i = 0; i < chunks.Count; i++)
                {
                    var chunkText = chunks[i];
                    if (string.IsNullOrWhiteSpace(chunkText))
                        continue;

                    var chunkEmbedding = await _embeddingService.GenerateEmbeddingAsync(chunkText);
                    chunkDocs.Add(new TextChunk
                    {
                        TextId = text.TextId,
                        Content = chunkText,
                        Index = i,
                        Embedding = chunkEmbedding
                    });
                }

                if (chunkDocs.Count > 0)
                {
                    await _textChunkCollection.InsertManyAsync(chunkDocs);
                }

                Console.WriteLine($"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] Summarization started text");
                var startTime = DateTime.UtcNow;
                
                var (summary, keyword) = await _summarizationService.SummarizeWithKeywordOllama(cleanedText, "text");
                
                var endTime = DateTime.UtcNow;
                var elapsedSeconds = (endTime - startTime).TotalSeconds;
                Console.WriteLine($"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] Summarization finished text - Elapsed: {elapsedSeconds:F2} seconds");
                
                var textName = $"Text Summary of {keyword}";

                var update = Builders<Text>.Update
                    .Set(t => t.Summary, summary)
                    .Set(t => t.TextName, textName)
                    .Set(t => t.Status, "Completed");

                _textCollection.UpdateOne(t => t.TextId == text.TextId, update);


                // Increment usage for regular users (role 2), not admins (role 1)
                await _summarizationService.IncrementUsageIfUser(userId);

                // Fetch the updated text to get the textName
                var updatedText = await _textCollection.Find(t => t.TextId == text.TextId).FirstOrDefaultAsync();

                return Ok(new
                {
                    message = "Text added and summarized",
                    documentId = text.TextId,
                    summary,
                    textName = updatedText?.TextName
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("[TextController] Summarization failed (add text).");
                Console.WriteLine(ex.ToString());

                var update = Builders<Text>.Update
                    .Set(t => t.Status, "Error");

                _textCollection.UpdateOne(t => t.TextId == text.TextId, update);

                return StatusCode(500, $"Summarization failed: {ex.Message}");
            }
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("summaries")]
        public IActionResult GetTextSummaries()
        {
            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // Get all text summaries for this user, ordered by creation date (newest first)
            var summaries = _textCollection
                .Find(t => t.UserId == userId && t.Status == "Completed" && !string.IsNullOrEmpty(t.Summary) && !t.IsDeleted)
                .SortByDescending(t => t.CreatedAt)
                .ToList();

            var result = summaries.Select(t => new
            {
                id = t.TextId,
                text = t.TextContent,
                textName = t.TextName,
                summary = t.Summary,
                createdAt = t.CreatedAt,
                status = t.Status,
                folderId = t.FolderId
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1, 2")]
        [HttpPatch("{id}")]
        public async Task<IActionResult> UpdateText(string id, [FromBody] dynamic updateData)
        {
            // Get userId from JWT token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // Verify text belongs to user
            var text = await _textCollection.Find(t => t.TextId == id && t.UserId == userId).FirstOrDefaultAsync();
            if (text == null)
                return NotFound("Text not found");

            var updateDef = Builders<Text>.Update;
            var updates = new List<UpdateDefinition<Text>>();

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
                        var folderCollection = _textCollection.Database.GetCollection<Folder>("folders");
                        var folder = await folderCollection.Find(f => f.FolderId == folderId && f.UserId == userId).FirstOrDefaultAsync();
                        if (folder == null)
                            return BadRequest("Folder not found or you don't have access");
                    }

                    updates.Add(updateDef.Set(t => t.FolderId, folderId));
                }
            }
            catch
            {
                return BadRequest("Invalid request body");
            }

            if (updates.Count > 0)
            {
                var combined = updateDef.Combine(updates);
                await _textCollection.UpdateOneAsync(t => t.TextId == id, combined);
            }

            return Ok(new { message = "Text updated successfully" });
        }

        // ----------------------------
        // Trash / Recycle Bin (soft delete)
        // ----------------------------

        [Authorize(Roles = "1, 2")]
        [HttpGet("trash")]
        public async Task<IActionResult> GetTrashedTexts()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var trashed = await _textCollection
                .Find(t => t.UserId == userId && t.IsDeleted)
                .SortByDescending(t => t.DeletedAt)
                .ToListAsync();

            var result = trashed.Select(t => new
            {
                id = t.TextId,
                text = t.TextContent,
                textName = t.TextName,
                summary = t.Summary,
                createdAt = t.CreatedAt,
                deletedAt = t.DeletedAt,
                status = t.Status,
                folderId = t.FolderId
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1, 2")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> SoftDeleteText(string id)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var idFilters = new List<FilterDefinition<Text>>
            {
                Builders<Text>.Filter.Eq(t => t.TextId, id),
                Builders<Text>.Filter.Eq("text_id", id)
            };
            if (ObjectId.TryParse(id, out var objId))
            {
                idFilters.Add(Builders<Text>.Filter.Eq("_id", objId));
                idFilters.Add(Builders<Text>.Filter.Eq("text_id", objId));
            }

            var filter = Builders<Text>.Filter.Or(idFilters) &
                         Builders<Text>.Filter.Ne(t => t.IsDeleted, true);

            if (!User.IsInRole("1"))
            {
                filter &= Builders<Text>.Filter.Eq(t => t.UserId, userId);
            }

            var update = Builders<Text>.Update
                .Set(t => t.IsDeleted, true)
                .Set(t => t.DeletedAt, DateTime.UtcNow);

            var result = await _textCollection.UpdateOneAsync(filter, update);
            if (result.MatchedCount == 0)
            {
                var existing = await _textCollection.Find(Builders<Text>.Filter.Or(idFilters)).FirstOrDefaultAsync();
                if (existing == null)
                    return NotFound("Text not found");

                if (!User.IsInRole("1") && existing.UserId != userId)
                    return NotFound("Text not found");

                if (existing.IsDeleted)
                    return Ok(new { message = "Text already in trash" });

                return NotFound("Text not found");
            }

            return Ok(new { message = "Text moved to trash" });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreText(string id)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var filter = Builders<Text>.Filter.Eq(t => t.TextId, id) &
                         Builders<Text>.Filter.Eq(t => t.IsDeleted, true);

            if (!User.IsInRole("1"))
            {
                filter &= Builders<Text>.Filter.Eq(t => t.UserId, userId);
            }

            var update = Builders<Text>.Update
                .Set(t => t.IsDeleted, false)
                .Set(t => t.DeletedAt, null);

            var result = await _textCollection.UpdateOneAsync(filter, update);
            if (result.MatchedCount == 0)
                return NotFound("Text not found in trash");

            return Ok(new { message = "Text restored" });
        }

        [Authorize(Roles = "1, 2")]
        [HttpDelete("{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteText(string id)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var filter = Builders<Text>.Filter.Eq(t => t.TextId, id);
            if (!User.IsInRole("1"))
            {
                filter &= Builders<Text>.Filter.Eq(t => t.UserId, userId);
            }

            // Find first so we only delete chunks for an accessible text
            var text = await _textCollection.Find(filter).FirstOrDefaultAsync();
            if (text == null)
                return NotFound("Text not found");

            await _textChunkCollection.DeleteManyAsync(c => c.TextId == text.TextId);

            var result = await _textCollection.DeleteOneAsync(filter);
            if (result.DeletedCount == 0)
                return NotFound("Text not found");

            return Ok(new { message = "Text deleted permanently" });
        }

        [Authorize(Roles = "1, 2")]
        [HttpDelete("trash/empty")]
        public async Task<IActionResult> EmptyTrash()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var trashedIds = await _textCollection
                .Find(t => t.UserId == userId && t.IsDeleted)
                .Project(t => t.TextId)
                .ToListAsync();

            trashedIds = trashedIds.Where(id => !string.IsNullOrWhiteSpace(id)).ToList();
            if (trashedIds.Any())
            {
                await _textChunkCollection.DeleteManyAsync(c => trashedIds.Contains(c.TextId));
            }

            var result = await _textCollection.DeleteManyAsync(t => t.UserId == userId && t.IsDeleted);
            return Ok(new { message = "Trash emptied", deletedCount = result.DeletedCount });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/count")]
        public async Task<IActionResult> GetAdminTextSummariesCount()
        {
            var count = await _textCollection.CountDocumentsAsync(t =>
                t.Status == "Completed" &&
                !string.IsNullOrEmpty(t.Summary) &&
                !t.IsDeleted
            );
            return Ok(new { count = (int)count });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/summaries")]
        public async Task<IActionResult> GetAllTextSummaries()
        {
            var texts = await _textCollection
                .Find(t => t.Status == "Completed" && !string.IsNullOrEmpty(t.Summary) && !t.IsDeleted)
                .SortByDescending(t => t.CreatedAt)
                .ToListAsync();

            var result = new List<object>();
            foreach (var text in texts)
            {
                var user = await _userCollection.Find(u => u.UserId == text.UserId).FirstOrDefaultAsync();
                result.Add(new
                {
                    id = text.TextId,
                    text = text.TextContent,
                    textName = text.TextName,
                    summary = text.Summary,
                    userId = text.UserId,
                    userEmail = user?.Email ?? "Unknown",
                    createdAt = text.CreatedAt
                });
            }

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpDelete("admin/{id}")]
        public async Task<IActionResult> DeleteTextSummary(string id)
        {
            var text = await _textCollection.Find(t => t.TextId == id).FirstOrDefaultAsync();
            if (text == null)
                return NotFound("Text summary not found");

            await _textChunkCollection.DeleteManyAsync(c => c.TextId == text.TextId);
            await _textCollection.DeleteOneAsync(t => t.TextId == id);
            return Ok(new { message = "Text summary deleted successfully" });
        }

        [Authorize(Roles = "1, 2")]
        [HttpDelete("bulk")]
        public async Task<IActionResult> DeleteTextSummariesBulk([FromBody] List<string> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided");

            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // For regular users, only allow deleting their own summaries
            var userRole = await _userRoleCollection.Find(ur => ur.UserId == userId).FirstOrDefaultAsync();
            if (userRole != null && userRole.RoleId == 2) // Role 2 is regular user
            {
                var allowedIds = await _textCollection
                    .Find(t => ids!.Contains(t.TextId!) && t.UserId == userId)
                    .Project(t => t.TextId)
                    .ToListAsync();

                allowedIds = allowedIds.Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
                if (allowedIds.Any())
                {
                    await _textChunkCollection.DeleteManyAsync(c => allowedIds.Contains(c.TextId));
                }

                var result = await _textCollection.DeleteManyAsync(t => ids!.Contains(t.TextId!) && t.UserId == userId);
                return Ok(new { message = "Text summaries deleted successfully", deletedCount = result.DeletedCount });
            }
            else // Admin can delete any
            {
                var allowedIds = await _textCollection
                    .Find(t => ids!.Contains(t.TextId!))
                    .Project(t => t.TextId)
                    .ToListAsync();

                allowedIds = allowedIds.Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
                if (allowedIds.Any())
                {
                    await _textChunkCollection.DeleteManyAsync(c => allowedIds.Contains(c.TextId));
                }

                var result = await _textCollection.DeleteManyAsync(t => ids!.Contains(t.TextId!));
                return Ok(new { message = "Text summaries deleted successfully", deletedCount = result.DeletedCount });
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

        private List<string> SplitTextIntoChunks(string text, int chunkSize)
        {
            var chunks = new List<string>();
            if (string.IsNullOrWhiteSpace(text))
                return chunks;

            if (chunkSize <= 0)
                chunkSize = 1000;

            var normalized = text.Trim();
            for (var i = 0; i < normalized.Length; i += chunkSize)
            {
                var len = Math.Min(chunkSize, normalized.Length - i);
                var chunk = normalized.Substring(i, len).Trim();
                if (!string.IsNullOrWhiteSpace(chunk))
                {
                    chunks.Add(chunk);
                }
            }

            return chunks;
        }

        private static int GetEnvInt(string key, int defaultValue, int min, int max)
        {
            try
            {
                var raw = Environment.GetEnvironmentVariable(key);
                if (int.TryParse(raw, out var value))
                {
                    return Math.Clamp(value, min, max);
                }
            }
            catch
            {
                // ignore and use default
            }

            return Math.Clamp(defaultValue, min, max);
        }
    }
}

