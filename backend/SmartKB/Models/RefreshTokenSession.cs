using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class RefreshTokenSession
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("refresh_token_id")]
        public string? Id { get; set; }

        [BsonElement("userId")]
        public string UserId { get; set; }

        [BsonElement("refreshToken")]
        public string Token { get; set; }

        [BsonElement("expiresAt")]
        public DateTime ExpiresAt { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
