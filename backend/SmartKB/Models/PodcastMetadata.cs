using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    [BsonIgnoreExtraElements]
    public class PodcastMetadata
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("documentId")]
        public string DocumentId { get; set; } = string.Empty;

        [BsonElement("audioUrl")]
        public string AudioUrl { get; set; } = string.Empty;

        [BsonElement("durationSeconds")]
        public double DurationSeconds { get; set; }

        [BsonElement("segments")]
        public List<PodcastSegment> Segments { get; set; } = new();

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

