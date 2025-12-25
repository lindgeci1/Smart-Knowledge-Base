using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using Stripe;
using System.Security.Claims;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "1, 2")]
    public class PaymentController : ControllerBase
    {
        private readonly IMongoCollection<Payment> _paymentCollection;
        private readonly IMongoCollection<Package> _packageCollection;
        private readonly IMongoCollection<Usage> _usageCollection;
        private readonly IConfiguration _configuration;
        private readonly StripeService _stripeService;

        public PaymentController(IConfiguration configuration)
        {
            _configuration = configuration;

            var client = new MongoClient(configuration["MongoDbSettings:ConnectionString"]);
            var database = client.GetDatabase(configuration["MongoDbSettings:DatabaseName"]);

            _paymentCollection = database.GetCollection<Payment>("payments");
            _packageCollection = database.GetCollection<Package>("packages");
            _usageCollection = database.GetCollection<Usage>("usage");

            // Initialize Stripe
            var stripeSecretKey = Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY")
                ?? configuration["Stripe:SecretKey"]
                ?? throw new Exception("Stripe secret key not configured");

            StripeConfiguration.ApiKey = stripeSecretKey;
            _stripeService = new StripeService();
        }

        [HttpPost("create-payment-intent")]
        public async Task<IActionResult> CreatePaymentIntent([FromBody] CreatePaymentIntentDto dto)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("userId")?.Value
                    ?? throw new UnauthorizedAccessException("User ID not found");

                // Get package
                var package = await _packageCollection
                    .Find(p => p.Id == dto.PackageId && p.IsActive)
                    .FirstOrDefaultAsync();

                if (package == null)
                    return NotFound("Package not found");

                // Create payment record with pending status
                var payment = new Payment
                {
                    UserId = userId,
                    PackageId = dto.PackageId,
                    Amount = package.Price,
                    Currency = "USD",
                    Status = "pending",
                    PaymentMethod = "card",
                    BillingEmail = dto.Email,
                    BillingName = dto.BillingName,
                    BillingAddress = dto.BillingAddress != null ? new BillingAddress
                    {
                        Line1 = dto.BillingAddress.Line1,
                        Line2 = dto.BillingAddress.Line2,
                        City = dto.BillingAddress.City,
                        State = dto.BillingAddress.State,
                        PostalCode = dto.BillingAddress.PostalCode,
                        Country = dto.BillingAddress.Country
                    } : null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _paymentCollection.InsertOneAsync(payment);

                // Create Stripe Payment Intent
                var options = new PaymentIntentCreateOptions
                {
                    Amount = (long)(package.Price * 100), // Convert to cents
                    Currency = "usd",
                    Description = $"Payment for package: {package.Name}",
                    PaymentMethodTypes = new List<string> { "card" },
                    Metadata = new Dictionary<string, string>
                    {
                        { "paymentId", payment.Id! },
                        { "packageId", package.Id! },
                        { "userId", userId },
                        { "packageName", package.Name }
                    }
                };

                var service = new PaymentIntentService();
                var paymentIntent = await service.CreateAsync(options);

                // Update payment with Stripe Payment Intent ID
                payment.StripePaymentIntentId = paymentIntent.Id;
                await _paymentCollection.ReplaceOneAsync(
                    p => p.Id == payment.Id,
                    payment
                );

                return Ok(new
                {
                    clientSecret = paymentIntent.ClientSecret,
                    paymentIntentId = paymentIntent.Id
                });
            }
            catch (StripeException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to create payment intent", message = ex.Message });
            }
        }

        [HttpPost("confirm")]
        public async Task<IActionResult> ConfirmPayment([FromBody] ConfirmPaymentDto dto)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("userId")?.Value
                    ?? throw new UnauthorizedAccessException("User ID not found");

                // Get payment record
                var payment = await _paymentCollection
                    .Find(p => p.StripePaymentIntentId == dto.PaymentIntentId && p.UserId == userId)
                    .FirstOrDefaultAsync();

                if (payment == null)
                    return NotFound("Payment not found");

                // Verify payment intent with Stripe
                var service = new PaymentIntentService();
                var paymentIntent = await service.GetAsync(dto.PaymentIntentId);

                if (paymentIntent.Status != "succeeded")
                {
                    payment.Status = paymentIntent.Status;
                    payment.UpdatedAt = DateTime.UtcNow;
                    await _paymentCollection.ReplaceOneAsync(p => p.Id == payment.Id, payment);

                    return BadRequest(new { error = $"Payment not completed. Status: {paymentIntent.Status}" });
                }

                // Payment succeeded - update payment record
                payment.Status = "succeeded";
                payment.StripeChargeId = paymentIntent.LatestChargeId;
                payment.PaidAt = DateTime.UtcNow;
                payment.UpdatedAt = DateTime.UtcNow;
                await _paymentCollection.ReplaceOneAsync(p => p.Id == payment.Id, payment);

                // Get package to update usage
                var package = await _packageCollection
                    .Find(p => p.Id == dto.PackageId)
                    .FirstOrDefaultAsync();

                if (package != null && package.SummaryLimit.HasValue)
                {
                    // Update or create usage record
                    var usage = await _usageCollection
                        .Find(u => u.UserId == userId)
                        .FirstOrDefaultAsync();

                    if (usage == null)
                    {
                        usage = new Usage
                        {
                            UserId = userId,
                            OverallUsage = 0,
                            TotalLimit = 100 + package.SummaryLimit.Value, // Default 100 + package limit
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        await _usageCollection.InsertOneAsync(usage);
                    }
                    else
                    {
                        // Add package limit to existing total limit
                        usage.TotalLimit += package.SummaryLimit.Value;
                        usage.UpdatedAt = DateTime.UtcNow;
                        await _usageCollection.ReplaceOneAsync(u => u.Id == usage.Id, usage);
                    }
                }

                return Ok(new
                {
                    message = "Payment confirmed successfully",
                    paymentId = payment.Id,
                    packageId = dto.PackageId
                });
            }
            catch (StripeException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to confirm payment", message = ex.Message });
            }
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetPaymentHistory()
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("userId")?.Value
                    ?? throw new UnauthorizedAccessException("User ID not found");

                var payments = await _paymentCollection
                    .Find(p => p.UserId == userId)
                    .SortByDescending(p => p.CreatedAt)
                    .ToListAsync();

                return Ok(payments);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to fetch payment history", message = ex.Message });
            }
        }
    }

    // Helper class for Stripe operations
    public class StripeService
    {
        // Can be extended with more Stripe operations
    }
}

