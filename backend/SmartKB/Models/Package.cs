using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class Package
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("name")]
        public string Name { get; set; } // "Starter Boost", "Pro Power", "Enterprise Scale"

        [BsonElement("description")]
        public string Description { get; set; } // "Perfect for small projects", etc.

        [BsonElement("price")]
        public decimal Price { get; set; } // 9, 29, 99

        [BsonElement("priceType")]
        public string PriceType { get; set; } = "one-time"; // "one-time" or "recurring"

        [BsonElement("summaryLimit")]
        public int? SummaryLimit { get; set; } // +50, +200, +1000 (nullable for flexibility)

        [BsonElement("features")]
        public List<string> Features { get; set; } = new List<string>(); // ["+50 Summaries", "Basic Support", etc.]

        [BsonElement("isPopular")]
        public bool IsPopular { get; set; } = false; // For "Most Popular" badge

        [BsonElement("isActive")]
        public bool IsActive { get; set; } = true; // To enable/disable packages

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

