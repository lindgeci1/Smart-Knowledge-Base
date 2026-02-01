using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class User
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [BsonElement("user_id")] 
        public string? UserId { get; set; }

        [BsonElement("email")]
        public string Email { get; set; }

        [BsonElement("username")]
        public string Username { get; set; }

        [BsonElement("passwordHash")]
        public string? PasswordHash { get; set; }

        [BsonElement("passwordSalt")]
        public string? PasswordSalt { get; set; }

        /// <summary>Google OAuth subject id. Set when user signs in or links Google.</summary>
        [BsonElement("googleId")]
        public string? GoogleId { get; set; }

        /// <summary>GitHub OAuth user id. Set when user signs in or links GitHub.</summary>
        [BsonElement("githubId")]
        public string? GitHubId { get; set; }

        [BsonElement("isActive")]
        public bool IsActive { get; set; } = true;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Two-factor authentication (TOTP)
        [BsonElement("twoFactorEnabled")]
        public bool TwoFactorEnabled { get; set; } = false;

        /// <summary>Base32 TOTP secret. Set after user confirms setup with a code.</summary>
        [BsonElement("twoFactorSecret")]
        public string? TwoFactorSecret { get; set; }

        /// <summary>Temporary secret during setup. Cleared after enable or expiry.</summary>
        [BsonElement("twoFactorPendingSecret")]
        public string? TwoFactorPendingSecret { get; set; }
    }
}
