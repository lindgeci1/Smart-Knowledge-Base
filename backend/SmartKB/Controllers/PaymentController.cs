using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using SmartKB.Services;
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
        private readonly EmailService _emailService;

        public PaymentController(IConfiguration configuration, EmailService emailService)
        {
            _configuration = configuration;
            _emailService = emailService;

            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

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

        /// <summary>
        /// Maps Stripe payment intent status to our simplified status: succeeded, incomplete, failed, or refunded
        /// If a refund date exists, the status will be "refunded"
        /// If a decline reason exists, the status will be "failed" (unless already "succeeded" or "refunded")
        /// </summary>
        private string MapStripeStatusToSimplifiedStatus(string stripeStatus, string? declineReason = null, DateTime? refundedAt = null)
        {
            // If payment has been refunded, always return refunded
            if (refundedAt.HasValue)
                return "refunded";

            // If payment succeeded, always return succeeded
            if (stripeStatus.ToLower() == "succeeded")
                return "succeeded";

            // If there's a decline reason, the payment should be marked as failed
            if (!string.IsNullOrEmpty(declineReason))
                return "failed";

            // Otherwise, map based on Stripe status
            return stripeStatus.ToLower() switch
            {
                "failed" => "failed",
                "canceled" => "failed",
                "incomplete" => "incomplete",
                _ => "incomplete" // All other statuses (requires_payment_method, requires_confirmation, requires_action, processing, pending, etc.) map to incomplete
            };
        }

        /// <summary>
        /// Extracts refund date from Stripe charges
        /// </summary>
        private async Task<DateTime?> ExtractRefundDateFromStripe(PaymentIntent paymentIntent)
        {
            if (string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                return null;

            try
            {
                var chargeService = new ChargeService();
                var charge = await chargeService.GetAsync(paymentIntent.LatestChargeId);

                // Check if charge has been refunded
                if (charge.Refunded)
                {
                    // Get the most recent refund date
                    var refundService = new RefundService();
                    var refunds = refundService.List(new RefundListOptions
                    {
                        Charge = paymentIntent.LatestChargeId
                    });

                    if (refunds.Data.Count > 0)
                    {
                        // Get the most recent refund
                        var latestRefund = refunds.Data.OrderByDescending(r => r.Created).FirstOrDefault();
                        if (latestRefund != null)
                        {
                            // Stripe.NET already converts Created to DateTime
                            return latestRefund.Created;
                        }
                    }

                    // Fallback: use charge created date if refunded but no refunds found
                    // Stripe.NET already converts Created to DateTime
                    return charge.Created;
                }

                return null;
            }
            catch (Exception ex)
            {
                // Log error but continue
                Console.WriteLine($"Error retrieving refund date: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Extracts decline reason from Stripe payment intent and its charges
        /// Only extracts decline reasons for actual failures (failed/canceled status or failed charges)
        /// </summary>
        private async Task<string?> ExtractDeclineReasonFromStripe(PaymentIntent paymentIntent)
        {
            // Never extract decline reason for succeeded payments
            if (paymentIntent.Status == "succeeded")
                return null;

            string? declineReason = null;

            // Only check LastPaymentError if payment is actually failed or canceled
            if ((paymentIntent.Status == "failed" || paymentIntent.Status == "canceled") && 
                paymentIntent.LastPaymentError != null)
            {
                // Prefer DeclineCode, then Message, but skip generic Type
                declineReason = paymentIntent.LastPaymentError.DeclineCode ?? 
                               paymentIntent.LastPaymentError.Message;
            }

            // Try to get from failed charges associated with this payment intent
            if (string.IsNullOrEmpty(declineReason))
            {
                try
                {
                    var chargeService = new ChargeService();
                    var charges = chargeService.List(new ChargeListOptions
                    {
                        PaymentIntent = paymentIntent.Id
                    });

                    // Check all charges for decline reasons - only for failed charges
                    foreach (var charge in charges.Data)
                    {
                        if (charge.Status == "failed")
                        {
                            // Only extract from failed charges
                            if (charge.Outcome != null)
                            {
                                // Prefer Reason, then SellerMessage, but skip generic Type
                                declineReason = charge.Outcome.Reason ?? 
                                               charge.Outcome.SellerMessage;
                            }

                            if (string.IsNullOrEmpty(declineReason) && charge.FailureMessage != null)
                            {
                                declineReason = charge.FailureMessage;
                            }

                            if (string.IsNullOrEmpty(declineReason) && charge.FailureCode != null)
                            {
                                declineReason = charge.FailureCode;
                            }

                            // If we found a reason, break
                            if (!string.IsNullOrEmpty(declineReason))
                                break;
                        }
                    }

                    // If still no reason and payment is failed/canceled, try the latest charge
                    if (string.IsNullOrEmpty(declineReason) && 
                        (paymentIntent.Status == "failed" || paymentIntent.Status == "canceled") &&
                        !string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                    {
                        var latestCharge = await chargeService.GetAsync(paymentIntent.LatestChargeId);
                        
                        // Only extract if charge is actually failed
                        if (latestCharge.Status == "failed")
                        {
                            if (latestCharge.Outcome != null)
                            {
                                declineReason = latestCharge.Outcome.Reason ?? 
                                               latestCharge.Outcome.SellerMessage;
                            }
                            if (string.IsNullOrEmpty(declineReason) && latestCharge.FailureMessage != null)
                            {
                                declineReason = latestCharge.FailureMessage;
                            }
                            if (string.IsNullOrEmpty(declineReason) && latestCharge.FailureCode != null)
                            {
                                declineReason = latestCharge.FailureCode;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Log error but continue
                    Console.WriteLine($"Error retrieving decline reason: {ex.Message}");
                }
            }

            return declineReason;
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

                // Create payment record with failed status (will be updated from Stripe)
                var payment = new Payment
                {
                    UserId = userId,
                    PackageId = dto.PackageId,
                    Amount = package.Price,
                    Currency = "USD",
                    Status = "failed",
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

                // Extract decline reason and refund date
                var declineReason = await ExtractDeclineReasonFromStripe(paymentIntent);
                var refundedAt = await ExtractRefundDateFromStripe(paymentIntent);
                
                payment.StripePaymentIntentId = paymentIntent.Id;
                
                // Update StripeCustomerId if available (may be set if customer was attached)
                if (!string.IsNullOrEmpty(paymentIntent.CustomerId))
                {
                    payment.StripeCustomerId = paymentIntent.CustomerId;
                }
                
                // Update refund date
                payment.RefundedAt = refundedAt;
                
                // Map status considering refund date
                payment.Status = MapStripeStatusToSimplifiedStatus(paymentIntent.Status, declineReason, refundedAt);
                payment.DeclineReason = declineReason;
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

                // Optimize: For successful payments, skip expensive API calls
                string? declineReason = null;
                DateTime? refundedAt = null;
                string simplifiedStatus;

                if (paymentIntent.Status == "succeeded")
                {
                    // Fast path for successful payments - no need to check decline reason or refunds
                    simplifiedStatus = "succeeded";
                    payment.Status = simplifiedStatus;
                    payment.DeclineReason = null;
                    
                    // Only check for refunds if charge exists (unlikely for new payment, but check anyway)
                    if (!string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                    {
                        refundedAt = await ExtractRefundDateFromStripe(paymentIntent);
                        payment.RefundedAt = refundedAt;
                        
                        // If refunded, update status
                        if (refundedAt.HasValue)
                        {
                            simplifiedStatus = "refunded";
                            payment.Status = simplifiedStatus;
                        }
                    }
                    
                    // Update payment record fields
                    payment.StripeChargeId = paymentIntent.LatestChargeId;
                    
                    // Update StripeCustomerId if available
                    if (!string.IsNullOrEmpty(paymentIntent.CustomerId))
                    {
                        payment.StripeCustomerId = paymentIntent.CustomerId;
                    }
                    
                    if (payment.PaidAt == null)
                    {
                        payment.PaidAt = DateTime.UtcNow;
                    }
                }
                else
                {
                    // For non-successful payments, extract decline reason and refund date
                    declineReason = await ExtractDeclineReasonFromStripe(paymentIntent);
                    refundedAt = await ExtractRefundDateFromStripe(paymentIntent);
                    
                    // Update refund date
                    payment.RefundedAt = refundedAt;
                    
                    // Map Stripe status to simplified status
                    simplifiedStatus = MapStripeStatusToSimplifiedStatus(paymentIntent.Status, declineReason, refundedAt);
                    payment.Status = simplifiedStatus;
                    payment.DeclineReason = declineReason;
                    
                    // Update StripeChargeId if available
                    if (!string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                    {
                        payment.StripeChargeId = paymentIntent.LatestChargeId;
                    }
                    
                    // Update StripeCustomerId if available
                    if (!string.IsNullOrEmpty(paymentIntent.CustomerId))
                    {
                        payment.StripeCustomerId = paymentIntent.CustomerId;
                    }
                    
                    if (simplifiedStatus != "succeeded" && simplifiedStatus != "refunded")
                    {
                        payment.UpdatedAt = DateTime.UtcNow;
                        await _paymentCollection.ReplaceOneAsync(p => p.Id == payment.Id, payment);
                        return BadRequest(new { error = $"Payment not completed. Status: {simplifiedStatus}", declineReason = payment.DeclineReason });
                    }
                }
                
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

                // Send payment confirmation email
                if (!string.IsNullOrEmpty(payment.BillingEmail) && package != null)
                {
                    try
                    {
                        var customerName = !string.IsNullOrEmpty(payment.BillingName) 
                            ? payment.BillingName 
                            : "Customer";
                        
                        await _emailService.SendPaymentConfirmationEmailAsync(
                            toEmail: payment.BillingEmail,
                            customerName: customerName,
                            packageName: package.Name,
                            amount: payment.Amount,
                            currency: payment.Currency,
                            paymentId: payment.Id ?? "",
                            paidAt: payment.PaidAt ?? DateTime.UtcNow
                        );
                    }
                    catch (Exception emailEx)
                    {
                        // Log email error but don't fail the payment confirmation
                        // Payment is already successful, email is just a notification
                        Console.WriteLine($"Failed to send payment confirmation email: {emailEx.Message}");
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

                // Sync status from Stripe for all payments and map to simplified status
                var service = new PaymentIntentService();
                foreach (var payment in payments)
                {
                    if (!string.IsNullOrEmpty(payment.StripePaymentIntentId))
                    {
                        try
                        {
                            var paymentIntent = await service.GetAsync(payment.StripePaymentIntentId);
                            
                            // Extract decline reason and refund date (needed for proper status mapping)
                            var declineReason = await ExtractDeclineReasonFromStripe(paymentIntent);
                            var refundedAt = await ExtractRefundDateFromStripe(paymentIntent);
                            
                            // Update refund date
                            payment.RefundedAt = refundedAt;
                            
                            // Map Stripe status to simplified status, considering decline reason and refund date
                            var simplifiedStatus = MapStripeStatusToSimplifiedStatus(paymentIntent.Status, declineReason, refundedAt);
                            payment.Status = simplifiedStatus;
                            payment.DeclineReason = declineReason;

                            // Update StripeChargeId if available (only exists for successful payments)
                            if (!string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                            {
                                payment.StripeChargeId = paymentIntent.LatestChargeId;
                            }

                            // Update StripeCustomerId if available
                            if (!string.IsNullOrEmpty(paymentIntent.CustomerId))
                            {
                                payment.StripeCustomerId = paymentIntent.CustomerId;
                            }

                            if (simplifiedStatus == "succeeded" && payment.PaidAt == null)
                            {
                                payment.PaidAt = DateTime.UtcNow;
                            }

                            payment.UpdatedAt = DateTime.UtcNow;
                            await _paymentCollection.ReplaceOneAsync(p => p.Id == payment.Id, payment);
                        }
                        catch { }
                    }
                }

                // Re-fetch to get updated statuses
                payments = await _paymentCollection
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

        [Authorize(Roles = "1")] // Admin only
        [HttpGet("admin")]
        public async Task<IActionResult> GetAllPayments()
        {
            try
            {
                var payments = await _paymentCollection
                    .Find(_ => true)
                    .SortByDescending(p => p.CreatedAt)
                    .ToListAsync();

                // Sync status from Stripe for all payments and map to simplified status
                var service = new PaymentIntentService();
                foreach (var payment in payments)
                {
                    if (!string.IsNullOrEmpty(payment.StripePaymentIntentId))
                    {
                        try
                        {
                            var paymentIntent = await service.GetAsync(payment.StripePaymentIntentId);
                            
                            // Extract decline reason and refund date (needed for proper status mapping)
                            var declineReason = await ExtractDeclineReasonFromStripe(paymentIntent);
                            var refundedAt = await ExtractRefundDateFromStripe(paymentIntent);
                            
                            // Update refund date
                            payment.RefundedAt = refundedAt;
                            
                            // Map Stripe status to simplified status, considering decline reason and refund date
                            var simplifiedStatus = MapStripeStatusToSimplifiedStatus(paymentIntent.Status, declineReason, refundedAt);
                            payment.Status = simplifiedStatus;
                            payment.DeclineReason = declineReason;

                            // Update StripeChargeId if available (only exists for successful payments)
                            if (!string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                            {
                                payment.StripeChargeId = paymentIntent.LatestChargeId;
                            }

                            // Update StripeCustomerId if available
                            if (!string.IsNullOrEmpty(paymentIntent.CustomerId))
                            {
                                payment.StripeCustomerId = paymentIntent.CustomerId;
                            }

                            if (simplifiedStatus == "succeeded" && payment.PaidAt == null)
                            {
                                payment.PaidAt = DateTime.UtcNow;
                            }

                            payment.UpdatedAt = DateTime.UtcNow;
                            await _paymentCollection.ReplaceOneAsync(p => p.Id == payment.Id, payment);
                        }
                        catch { }
                    }
                }

                // Re-fetch to get updated statuses
                payments = await _paymentCollection
                    .Find(_ => true)
                    .SortByDescending(p => p.CreatedAt)
                    .ToListAsync();

                // Enrich payments with user and package information
                var result = new List<object>();
                foreach (var payment in payments)
                {
                    var package = await _packageCollection
                        .Find(p => p.Id == payment.PackageId)
                        .FirstOrDefaultAsync();

                    result.Add(new
                    {
                        userId = payment.UserId,
                        packageId = payment.PackageId,
                        packageName = package?.Name ?? "Unknown Package",
                        amount = payment.Amount,
                        currency = payment.Currency,
                        status = payment.Status,
                        declineReason = payment.DeclineReason,
                        paymentMethod = payment.PaymentMethod,
                        billingEmail = payment.BillingEmail,
                        billingName = payment.BillingName,
                        stripePaymentIntentId = payment.StripePaymentIntentId,
                        stripeChargeId = payment.StripeChargeId,
                        createdAt = payment.CreatedAt,
                        paidAt = payment.PaidAt,
                        refundedAt = payment.RefundedAt
                    });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to fetch payments", message = ex.Message });
            }
        }

    }

    // Helper class for Stripe operations
    public class StripeService
    {
        // Can be extended with more Stripe operations
    }
}

