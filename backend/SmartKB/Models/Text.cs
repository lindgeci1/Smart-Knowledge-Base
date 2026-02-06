using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class Text
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("text_id")]
        public string? TextId { get; set; }

        [BsonElement("textContent")]
        public string TextContent { get; set; }

        [BsonElement("textName")]
        public string? TextName { get; set; }

        [BsonElement("summary")]
        public string Summary { get; set; }

        [BsonElement("status")]
        public string Status { get; set; } = "Pending";

        [BsonElement("userId")]
        public string UserId { get; set; }

        [BsonElement("folder_id")]
        public string? FolderId { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("isDeleted")]
        public bool IsDeleted { get; set; } = false;

        [BsonElement("deletedAt")]
        public DateTime? DeletedAt { get; set; }

        [BsonElement("embedding")]
        public float[]? Embedding { get; set; } // Vector embedding for semantic search (typically 768 dimensions)
    }
}

