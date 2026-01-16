using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class SharedDocument
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("shared_document_id")]
        public string? SharedDocumentId { get; set; }

        [BsonElement("document_id")]
        public string DocumentId { get; set; }

        [BsonElement("document_type")]
        public string DocumentType { get; set; } // "file" or "text"

        [BsonElement("shared_by_user_id")]
        public string SharedByUserId { get; set; }

        [BsonElement("shared_with_email")]
        public string SharedWithEmail { get; set; }

        [BsonElement("shared_with_user_id")]
        public string? SharedWithUserId { get; set; } // null if user doesn't exist yet

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
