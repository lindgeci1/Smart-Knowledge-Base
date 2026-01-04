using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
        private readonly IMongoCollection<User> _userCollection;
        private readonly IMongoCollection<UserRole> _userRoleCollection;
        private readonly IMongoCollection<Usage> _usageCollection;
        private readonly SummarizationService _summarizationService;

        public TextController(IConfiguration configuration)
        {
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _textCollection = database.GetCollection<Text>("texts");
            _userCollection = database.GetCollection<User>("users");
            _userRoleCollection = database.GetCollection<UserRole>("userRoles");
            _usageCollection = database.GetCollection<Usage>("usage");
            _summarizationService = new SummarizationService(_userRoleCollection, _usageCollection);
        }

        [AllowAnonymous]
        [HttpGet("count")]
        public async Task<IActionResult> GetTextSummariesCount()
        {
            var count = await _textCollection.CountDocumentsAsync(t => t.Status == "Completed" && !string.IsNullOrEmpty(t.Summary));
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

            var text = new Text
            {
                TextContent = dto.Text,
                TextName = null,
                Summary = null,
                Status = "Pending",
                UserId = userId,
                FolderId = string.IsNullOrWhiteSpace(folderId) ? null : folderId,
                CreatedAt = DateTime.UtcNow
            };

            _textCollection.InsertOne(text);

            try
            {
                var (summary, keyword) = await _summarizationService.SummarizeWithKeyword(dto.Text, "text");
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
            catch
            {
                var update = Builders<Text>.Update
                    .Set(t => t.Status, "Error");

                _textCollection.UpdateOne(t => t.TextId == text.TextId, update);

                return StatusCode(500, "Summarization failed");
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
                .Find(t => t.UserId == userId && t.Status == "Completed" && !string.IsNullOrEmpty(t.Summary))
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

        [Authorize(Roles = "1")]
        [HttpGet("admin/count")]
        public async Task<IActionResult> GetAdminTextSummariesCount()
        {
            var count = await _textCollection.CountDocumentsAsync(t => t.Status == "Completed" && !string.IsNullOrEmpty(t.Summary));
            return Ok(new { count = (int)count });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/summaries")]
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
                var result = await _textCollection.DeleteManyAsync(t => ids.Contains(t.TextId) && t.UserId == userId);
                return Ok(new { message = "Text summaries deleted successfully", deletedCount = result.DeletedCount });
            }
            else // Admin can delete any
            {
                var result = await _textCollection.DeleteManyAsync(t => ids.Contains(t.TextId));
                return Ok(new { message = "Text summaries deleted successfully", deletedCount = result.DeletedCount });
            }
        }
    }
}

