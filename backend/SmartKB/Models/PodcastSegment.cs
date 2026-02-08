using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class PodcastSegment
    {
        [BsonElement("speaker")]
        public string Speaker { get; set; } = string.Empty;

        [BsonElement("startTime")]
        public double StartTime { get; set; }

        [BsonElement("endTime")]
        public double EndTime { get; set; }
    }
}

