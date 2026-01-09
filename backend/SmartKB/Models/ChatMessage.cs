using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class ChatMessage
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("chat_message_id")]
        public string? ChatMessageId { get; set; }

        [BsonElement("chatId")]
        public string ChatId { get; set; }

        [BsonElement("role")]
        public string Role { get; set; } // "user" or "assistant"

        [BsonElement("content")]
        public string Content { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}