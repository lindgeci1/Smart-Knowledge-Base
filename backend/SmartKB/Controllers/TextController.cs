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
        private readonly IMongoCollection<TextDocument> _textCollection;
        private readonly IMongoCollection<User> _userCollection;
        private readonly IMongoCollection<UserRole> _userRoleCollection;
        private readonly IMongoCollection<Usage> _usageCollection;
        private readonly SummarizationService _summarizationService;

        public TextController(IConfiguration configuration)
        {
            var client = new MongoClient(configuration["MongoDbSettings:ConnectionString"]);
            var database = client.GetDatabase(configuration["MongoDbSettings:DatabaseName"]);

            _textCollection = database.GetCollection<TextDocument>("texts");
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

            var textDocument = new TextDocument
            {
                Text = dto.Text,
                TextName = "text summary",
                Summary = null,
                Status = "Pending",
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _textCollection.InsertOne(textDocument);

            try
            {
                string summary = await _summarizationService.SummarizeWithOllama(dto.Text, "text");

                var update = Builders<TextDocument>.Update
                    .Set(t => t.Summary, summary)
                    .Set(t => t.Status, "Completed");

                _textCollection.UpdateOne(t => t.Id == textDocument.Id, update);

                // Increment usage for regular users (role 2), not admins (role 1)
                await _summarizationService.IncrementUsageIfUser(userId);

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
                id = t.Id,
                text = t.Text,
                textName = t.TextName,
                summary = t.Summary,
                createdAt = t.CreatedAt,
                status = t.Status
            }).ToList();

            return Ok(result);
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
                    id = text.Id,
                    text = text.Text,
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
            var text = await _textCollection.Find(t => t.Id == id).FirstOrDefaultAsync();
            if (text == null)
                return NotFound("Text summary not found");

            await _textCollection.DeleteOneAsync(t => t.Id == id);
            return Ok(new { message = "Text summary deleted successfully" });
        }
    }
}

