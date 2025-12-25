using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class PasswordResetToken
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("userId")]
        public string UserId { get; set; }

        [BsonElement("token")]
        public string Token { get; set; }

        [BsonElement("expiresAt")]
        public DateTime ExpiresAt { get; set; }

        [BsonElement("isUsed")]
        public bool IsUsed { get; set; } = false;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

