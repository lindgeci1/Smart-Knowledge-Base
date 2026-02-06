using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.Models;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly IMongoCollection<Notification> _notificationCollection;

        public NotificationsController(IConfiguration configuration)
        {
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ??
                                   configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ??
                               configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _notificationCollection = database.GetCollection<Notification>("notifications");
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet]
        public async Task<IActionResult> GetMyNotifications([FromQuery] int limit = 50)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;
            limit = Math.Clamp(limit, 1, 200);

            var notifications = await _notificationCollection
                .Find(n => n.UserId == userId)
                .SortByDescending(n => n.CreatedAt)
                .Limit(limit)
                .ToListAsync();

            var result = notifications.Select(n => new
            {
                id = n.NotificationId,
                type = n.Type,
                title = n.Title,
                message = n.Message,
                link = n.Link,
                isRead = n.IsRead,
                createdAt = n.CreatedAt,
                metadata = n.Metadata
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var count = await _notificationCollection.CountDocumentsAsync(n => n.UserId == userId && !n.IsRead);
            return Ok(new { unreadCount = (int)count });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkRead(string id)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var filter = Builders<Notification>.Filter.Eq(n => n.NotificationId, id) &
                         Builders<Notification>.Filter.Eq(n => n.UserId, userId);

            var update = Builders<Notification>.Update.Set(n => n.IsRead, true);
            var result = await _notificationCollection.UpdateOneAsync(filter, update);

            if (result.MatchedCount == 0)
                return NotFound("Notification not found");

            return Ok(new { message = "Notification marked as read" });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPut("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var filter = Builders<Notification>.Filter.Eq(n => n.UserId, userId) &
                         Builders<Notification>.Filter.Eq(n => n.IsRead, false);

            var update = Builders<Notification>.Update.Set(n => n.IsRead, true);
            var result = await _notificationCollection.UpdateManyAsync(filter, update);

            return Ok(new { message = "All notifications marked as read", updatedCount = result.ModifiedCount });
        }
    }
}

