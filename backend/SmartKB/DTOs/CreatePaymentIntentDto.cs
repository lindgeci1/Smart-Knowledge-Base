namespace SmartKB.DTOs
{
    public class CreatePaymentIntentDto
    {
        public string PackageId { get; set; }
        public string Email { get; set; }
        public string? BillingName { get; set; }
        public BillingAddressDto? BillingAddress { get; set; }
    }

    public class BillingAddressDto
    {
        public string? Line1 { get; set; }
        public string? Line2 { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }
    }
}

