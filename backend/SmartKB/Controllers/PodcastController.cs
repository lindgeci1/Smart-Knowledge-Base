using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using SmartKB.Models;
using SmartKB.Services;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PodcastController : ControllerBase
    {
        private readonly IMongoCollection<Document> _documentCollection;
        private readonly IMongoCollection<Text> _textCollection;
        private readonly IMongoCollection<PodcastMetadata> _podcastMetadataCollection;
        private readonly PodcastService _podcastService;
        private readonly ILogger<PodcastController> _logger;

        public PodcastController(
            IConfiguration configuration,
            PodcastService podcastService,
            ILogger<PodcastController> logger
        )
        {
            _podcastService = podcastService;
            _logger = logger;

            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ??
                                   configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ??
                               configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _documentCollection = database.GetCollection<Document>("documents");
            _textCollection = database.GetCollection<Text>("texts");
            _podcastMetadataCollection = database.GetCollection<PodcastMetadata>("podcast_metadata");
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("metadata/{documentId}")]
        public async Task<IActionResult> GetMetadata(string documentId, CancellationToken ct)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // Ensure the user owns the document/text for this id
            var doc = await _documentCollection
                .Find(d => d.DocumentId == documentId && d.UserId == userId && !d.IsDeleted)
                .FirstOrDefaultAsync(ct);

            if (doc == null)
            {
                var textDoc = await _textCollection
                    .Find(t => t.TextId == documentId && t.UserId == userId && !t.IsDeleted)
                    .FirstOrDefaultAsync(ct);

                if (textDoc == null)
                    return NotFound("Document/Text not found.");
            }

            var existing = await _podcastMetadataCollection
                .Find(p => p.DocumentId == documentId && !string.IsNullOrEmpty(p.AudioUrl))
                .FirstOrDefaultAsync(ct);

            if (existing == null)
                return NotFound();

            return Ok(new
            {
                audioUrl = existing.AudioUrl,
                isCached = true,
                durationSeconds = existing.DurationSeconds,
                segments = existing.Segments
            });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPost("generate/{documentId}")]
        public async Task<IActionResult> Generate(string documentId, CancellationToken ct)
        {
            try
            {
                // Validate config early (Render env)
                if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GOOGLE_CREDENTIALS_JSON")))
                {
                    _logger.LogWarning("GOOGLE_CREDENTIALS_JSON is empty. Google TTS may fail if no local credentials file exists.");
                }

                var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
                if (userIdClaim == null)
                    return Unauthorized("User ID not found in token.");

                var userId = userIdClaim.Value;

                // 1) Try file document
                var doc = await _documentCollection
                    .Find(d => d.DocumentId == documentId && d.UserId == userId && !d.IsDeleted)
                    .FirstOrDefaultAsync(ct);

                string? title = null;
                string? text = null;
                Text? textDoc = null;

                if (doc != null)
                {
                    title = doc.DocumentName ?? doc.FileName ?? "Document Podcast";
                    text = doc.FileData;
                }
                else
                {
                    // 2) Try text summary entry
                    textDoc = await _textCollection
                        .Find(t => t.TextId == documentId && t.UserId == userId && !t.IsDeleted)
                        .FirstOrDefaultAsync(ct);

                    if (textDoc != null)
                    {
                        title = textDoc.TextName ?? "Text Podcast";
                        text = textDoc.TextContent;
                    }
                }

                if (string.IsNullOrWhiteSpace(text))
                    return NotFound("Document/Text not found or has no content.");

                // Cache lookup (Mongo) - same ID works for documents and texts.
                var existing = await _podcastMetadataCollection
                    .Find(p => p.DocumentId == documentId && !string.IsNullOrEmpty(p.AudioUrl))
                    .FirstOrDefaultAsync(ct);

                if (existing != null)
                {
                    // Optional FK update for texts (if missing).
                    if (textDoc != null && !string.IsNullOrWhiteSpace(existing.Id))
                    {
                        var setFk = Builders<Text>.Update.Set("podcastMetadataId", existing.Id);
                        await _textCollection.UpdateOneAsync(t => t.TextId == textDoc.TextId, setFk, cancellationToken: ct);
                    }

                    return Ok(new
                    {
                        audioUrl = existing.AudioUrl,
                        status = "success",
                        isCached = true,
                        durationSeconds = existing.DurationSeconds,
                        segments = existing.Segments
                    });
                }

                var result = await _podcastService.GeneratePodcastAsync(documentId, text, ct);

                var entity = new PodcastMetadata
                {
                    Id = ObjectId.GenerateNewId().ToString(),
                    DocumentId = documentId,
                    AudioUrl = result.AudioUrl,
                    DurationSeconds = result.DurationSeconds,
                    Segments = result.Segments,
                    CreatedAt = DateTime.UtcNow
                };

                await _podcastMetadataCollection.InsertOneAsync(entity, cancellationToken: ct);

                // FK update for texts (requested)
                if (textDoc != null)
                {
                    var setFk = Builders<Text>.Update.Set("podcastMetadataId", entity.Id);
                    await _textCollection.UpdateOneAsync(t => t.TextId == textDoc.TextId, setFk, cancellationToken: ct);
                }

                return Ok(new
                {
                    audioUrl = result.AudioUrl,
                    status = "success",
                    isCached = false,
                    durationSeconds = result.DurationSeconds,
                    segments = result.Segments
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CRITICAL ERROR generating podcast: {Message}", ex.Message);
                return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
            }
        }
    }
}

