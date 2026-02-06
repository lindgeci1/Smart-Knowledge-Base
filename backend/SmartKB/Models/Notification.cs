using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    [BsonIgnoreExtraElements]
    public class Notification
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("notification_id")]
        public string? NotificationId { get; set; }

        [BsonElement("userId")]
        public string UserId { get; set; }

        [BsonElement("type")]
        public string Type { get; set; } = "info"; // e.g. "share", "comment", "payment"

        [BsonElement("title")]
        public string Title { get; set; } = string.Empty;

        [BsonElement("message")]
        public string Message { get; set; } = string.Empty;

        [BsonElement("link")]
        public string? Link { get; set; } // frontend route

        [BsonElement("isRead")]
        public bool IsRead { get; set; } = false;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("metadata")]
        public Dictionary<string, string>? Metadata { get; set; }
    }
}

