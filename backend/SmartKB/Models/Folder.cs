using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    [BsonIgnoreExtraElements]
    public class Folder
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("folder_id")]
        public string? FolderId { get; set; }

        [BsonElement("user_id")]
        public string UserId { get; set; }

        [BsonElement("name")]
        public string Name { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
