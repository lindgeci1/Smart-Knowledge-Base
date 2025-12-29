using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "1, 2")]
    public class FolderController : ControllerBase
    {
        private readonly IMongoCollection<Folder> _folderCollection;
        private readonly IMongoCollection<Document> _documentCollection;
        private readonly IMongoCollection<TextDocument> _textCollection;

        public FolderController(IConfiguration configuration)
        {
            var client = new MongoClient(configuration["MongoDbSettings:ConnectionString"]);
            var database = client.GetDatabase(configuration["MongoDbSettings:DatabaseName"]);

            _folderCollection = database.GetCollection<Folder>("folders");
            _documentCollection = database.GetCollection<Document>("documents");
            _textCollection = database.GetCollection<TextDocument>("texts");
        }

        // Get all folders for current user
        [HttpGet]
        public async Task<IActionResult> GetFolders()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var folders = await _folderCollection
                .Find(f => f.UserId == userId)
                .SortBy(f => f.Name)
                .ToListAsync();

            var folderDtos = new List<FolderResponseDto>();

            foreach (var folder in folders)
            {
                // Count items in folder
                var documentCount = await _documentCollection.CountDocumentsAsync(d => d.FolderId == folder.FolderId);
                var textCount = await _textCollection.CountDocumentsAsync(t => t.FolderId == folder.FolderId);

                folderDtos.Add(new FolderResponseDto
                {
                    Id = folder.FolderId,
                    Name = folder.Name,
                    CreatedAt = folder.CreatedAt,
                    UpdatedAt = folder.UpdatedAt,
                    ItemCount = (int)(documentCount + textCount)
                });
            }

            return Ok(folderDtos);
        }

        // Get single folder by ID
        [HttpGet("{id}")]
        public async Task<IActionResult> GetFolderById(string id)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var folder = await _folderCollection.Find(f => f.FolderId == id && f.UserId == userId).FirstOrDefaultAsync();
            if (folder == null)
                return NotFound("Folder not found");

            var documentCount = await _documentCollection.CountDocumentsAsync(d => d.FolderId == id);
            var textCount = await _textCollection.CountDocumentsAsync(t => t.FolderId == id);

            return Ok(new FolderResponseDto
            {
                Id = folder.FolderId,
                Name = folder.Name,
                CreatedAt = folder.CreatedAt,
                UpdatedAt = folder.UpdatedAt,
                ItemCount = (int)(documentCount + textCount)
            });
        }

        // Create new folder
        [HttpPost]
        public async Task<IActionResult> CreateFolder([FromBody] CreateFolderDto dto)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("Folder name is required");

            var userId = userIdClaim.Value;

            var folder = new Folder
            {
                UserId = userId,
                Name = dto.Name,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _folderCollection.InsertOneAsync(folder);

            return Ok(new
            {
                message = "Folder created successfully",
                folderId = folder.FolderId,
                name = folder.Name
            });
        }

        // Update folder
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateFolder(string id, [FromBody] UpdateFolderDto dto)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var folder = await _folderCollection.Find(f => f.FolderId == id && f.UserId == userId).FirstOrDefaultAsync();
            if (folder == null)
                return NotFound("Folder not found");

            var updateBuilder = Builders<Folder>.Update.Set(f => f.UpdatedAt, DateTime.UtcNow);

            if (!string.IsNullOrWhiteSpace(dto.Name))
                updateBuilder = updateBuilder.Set(f => f.Name, dto.Name);

            await _folderCollection.UpdateOneAsync(f => f.FolderId == id, updateBuilder);

            return Ok(new { message = "Folder updated successfully" });
        }

        // Delete folder and move its contents to root (FolderId = null)
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFolder(string id)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var folder = await _folderCollection.Find(f => f.FolderId == id && f.UserId == userId).FirstOrDefaultAsync();
            if (folder == null)
                return NotFound("Folder not found");

            // Move all documents and texts to root (null)
            var documentUpdate = Builders<Document>.Update.Set(d => d.FolderId, null);
            await _documentCollection.UpdateManyAsync(d => d.FolderId == id, documentUpdate);

            var textUpdate = Builders<TextDocument>.Update.Set(t => t.FolderId, null);
            await _textCollection.UpdateManyAsync(t => t.FolderId == id, textUpdate);

            // Delete folder
            await _folderCollection.DeleteOneAsync(f => f.FolderId == id);

            return Ok(new { message = "Folder deleted successfully. Items moved to root." });
        }
    }
}
