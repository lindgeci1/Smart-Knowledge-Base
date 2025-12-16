using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class Document
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("fileName")]
        public string FileName { get; set; }

        [BsonElement("fileType")]
        public string FileType { get; set; }

        [BsonElement("fileData")]
        public string FileData { get; set; }

        [BsonElement("summary")]
        public string Summary { get; set; }

        [BsonElement("status")]
        public string Status { get; set; } = "Pending";

        [BsonElement("userId")]
        public string UserId { get; set; }
    }
}
