using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    [BsonIgnoreExtraElements]
    public class DocumentChunk
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("documentId")]
        public string DocumentId { get; set; } = string.Empty;

        [BsonElement("content")]
        public string Content { get; set; } = string.Empty;

        [BsonElement("index")]
        public int Index { get; set; }

        [BsonElement("embedding")]
        public float[] Embedding { get; set; } = Array.Empty<float>();
    }
}

