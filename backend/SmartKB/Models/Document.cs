using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    [BsonIgnoreExtraElements]
    public class Document
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("document_id")]
        public string? DocumentId { get; set; }

        [BsonElement("fileName")]
        public string FileName { get; set; }

        [BsonElement("fileType")]
        public string FileType { get; set; }

        [BsonElement("fileData")]
        public string FileData { get; set; }

        [BsonElement("summary")]
        public string Summary { get; set; }

        [BsonElement("documentName")]
        public string? DocumentName { get; set; }

        [BsonElement("status")]
        public string Status { get; set; } = "Pending";

        [BsonElement("userId")]
        public string UserId { get; set; }

        [BsonElement("folder_id")]
        public string? FolderId { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("embedding")]
        public float[]? Embedding { get; set; } // Vector embedding for semantic search (typically 768 dimensions)
    }
}
