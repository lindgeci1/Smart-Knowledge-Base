using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class ActivationRequest
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("activation_id")]
        public string? ActivationId { get; set; }

        [BsonElement("email")]
        public string Email { get; set; }

        [BsonElement("username")]
        public string? Username { get; set; }

        [BsonElement("message")]
        public string? Message { get; set; }

        [BsonElement("status")]
        public string Status { get; set; } = "pending"; // pending, approved, rejected

        [BsonElement("userId")]
        public string? UserId { get; set; } // Will be set if user exists

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("processedAt")]
        public DateTime? ProcessedAt { get; set; }
    }
}

