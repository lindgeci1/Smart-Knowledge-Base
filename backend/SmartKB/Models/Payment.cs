using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartKB.Models
{
    public class Payment
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("userId")]
        public string UserId { get; set; } // Reference to User

        [BsonElement("packageId")]
        public string PackageId { get; set; } // Reference to Package

        // Stripe Integration Fields
        [BsonElement("stripePaymentIntentId")]
        public string? StripePaymentIntentId { get; set; } // Stripe Payment Intent ID

        [BsonElement("stripeCustomerId")]
        public string? StripeCustomerId { get; set; } // Stripe Customer ID

        [BsonElement("stripeChargeId")]
        public string? StripeChargeId { get; set; } // Stripe Charge ID

        // Payment Details
        [BsonElement("amount")]
        public decimal Amount { get; set; } // Payment amount

        [BsonElement("currency")]
        public string Currency { get; set; } = "USD"; // Currency code

        [BsonElement("status")]
        public string Status { get; set; } = "failed"; // Simplified status from Stripe: "succeeded", "incomplete", or "failed"

        [BsonElement("declineReason")]
        public string? DeclineReason { get; set; } // Reason for payment failure/decline (e.g., "card_declined", "insufficient_funds", "expired_card", etc.)

        [BsonElement("paymentMethod")]
        public string PaymentMethod { get; set; } = "card"; // "card", "paypal", etc.

        // Billing Information
        [BsonElement("billingEmail")]
        public string? BillingEmail { get; set; }

        [BsonElement("billingName")]
        public string? BillingName { get; set; }

        [BsonElement("billingAddress")]
        public BillingAddress? BillingAddress { get; set; }

        // Metadata
        [BsonElement("metadata")]
        public Dictionary<string, string>? Metadata { get; set; } // Additional Stripe metadata

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("paidAt")]
        public DateTime? PaidAt { get; set; } // When payment was completed
    }

    public class BillingAddress
    {
        [BsonElement("line1")]
        public string? Line1 { get; set; }

        [BsonElement("line2")]
        public string? Line2 { get; set; }

        [BsonElement("city")]
        public string? City { get; set; }

        [BsonElement("state")]
        public string? State { get; set; }

        [BsonElement("postalCode")]
        public string? PostalCode { get; set; }

        [BsonElement("country")]
        public string? Country { get; set; }
    }
}

