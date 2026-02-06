using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    [BsonIgnoreExtraElements]
    public class TextChunk
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("textId")]
        public string TextId { get; set; } = string.Empty;

        [BsonElement("content")]
        public string Content { get; set; } = string.Empty;

        [BsonElement("index")]
        public int Index { get; set; }

        [BsonElement("embedding")]
        public float[] Embedding { get; set; } = Array.Empty<float>();
    }
}

