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

        /// <summary>
        /// Maps Stripe payment intent status to our simplified status: succeeded, incomplete, or failed
        /// </summary>
        private string MapStripeStatusToSimplifiedStatus(string stripeStatus)
        {
            return stripeStatus.ToLower() switch
            {
                "succeeded" => "succeeded",
                "failed" => "failed",
                "canceled" => "failed",
                "incomplete" => "incomplete",
                _ => "incomplete" // All other statuses (requires_payment_method, requires_confirmation, requires_action, processing, pending, etc.) map to incomplete
            };
        }

        /// <summary>
        /// Extracts decline reason from Stripe payment intent and its charges
        /// </summary>
        private async Task<string?> ExtractDeclineReasonFromStripe(PaymentIntent paymentIntent)
        {
            string? declineReason = null;

            // Try to get decline reason from LastPaymentError
            if (paymentIntent.LastPaymentError != null)
            {
                declineReason = paymentIntent.LastPaymentError.DeclineCode ?? 
                               paymentIntent.LastPaymentError.Message ??
                               paymentIntent.LastPaymentError.Type;
            }

            // Try to get from all charges associated with this payment intent
            if (string.IsNullOrEmpty(declineReason))
            {
                try
                {
                    var chargeService = new ChargeService();
                    var charges = chargeService.List(new ChargeListOptions
                    {
                        PaymentIntent = paymentIntent.Id
                    });

                    // Check all charges for decline reasons
                    foreach (var charge in charges.Data)
                    {
                        if (charge.Status == "failed")
                        {
                            if (charge.Outcome != null)
                            {
                                declineReason = charge.Outcome.Reason ?? 
                                               charge.Outcome.SellerMessage ??
                                               charge.Outcome.Type;
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

                    // If still no reason, try the latest charge
                    if (string.IsNullOrEmpty(declineReason) && !string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                    {
                        var latestCharge = await chargeService.GetAsync(paymentIntent.LatestChargeId);
                        if (latestCharge.Outcome != null)
                        {
                            declineReason = latestCharge.Outcome.Reason ?? 
                                           latestCharge.Outcome.SellerMessage ??
                                           latestCharge.Outcome.Type;
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
                catch (Exception ex)
                {
                    // Log error but continue
                    Console.WriteLine($"Error retrieving decline reason: {ex.Message}");
                }
            }

            return declineReason;
        }

        /// <summary>
        /// Syncs payment status and decline reason from Stripe
        /// </summary>
        private async Task SyncPaymentStatusFromStripe(Payment payment)
        {
            if (string.IsNullOrEmpty(payment.StripePaymentIntentId))
                return;

            try
            {
                var service = new PaymentIntentService();
                var paymentIntent = await service.GetAsync(payment.StripePaymentIntentId);

                // Always update status from Stripe (supports all Stripe statuses)
                payment.Status = paymentIntent.Status;

                // Capture decline reason if payment failed or was canceled
                if (paymentIntent.Status != "succeeded" && paymentIntent.Status != "pending" && paymentIntent.Status != "processing")
                {
                    string? declineReason = null;

                    // Try to get decline reason from LastPaymentError
                    if (paymentIntent.LastPaymentError != null)
                    {
                        declineReason = paymentIntent.LastPaymentError.DeclineCode ?? paymentIntent.LastPaymentError.Message;
                    }

                    // If no error in payment intent, try to get from the charge
                    if (string.IsNullOrEmpty(declineReason) && !string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                    {
                        try
                        {
                            var chargeService = new ChargeService();
                            var charge = await chargeService.GetAsync(paymentIntent.LatestChargeId);

                            if (charge.Outcome != null)
                            {
                                declineReason = charge.Outcome.Reason ?? charge.Outcome.SellerMessage;
                            }

                            if (string.IsNullOrEmpty(declineReason) && charge.FailureMessage != null)
                            {
                                declineReason = charge.FailureMessage;
                            }
                        }
                        catch
                        {
                            // If charge retrieval fails, continue without decline reason
                        }
                    }

                    payment.DeclineReason = declineReason;
                }
                else
                {
                    // Clear decline reason for successful or pending payments
                    payment.DeclineReason = null;
                }

                // Update StripeChargeId if available
                if (!string.IsNullOrEmpty(paymentIntent.LatestChargeId))
                {
                    payment.StripeChargeId = paymentIntent.LatestChargeId;
                }

                // Update PaidAt if payment succeeded
                if (paymentIntent.Status == "succeeded" && payment.PaidAt == null)
                {
                    payment.PaidAt = DateTime.UtcNow;
                }

                payment.UpdatedAt = DateTime.UtcNow;
                await _paymentCollection.ReplaceOneAsync(p => p.Id == payment.Id, payment);
            }
            catch (StripeException)
            {
                // If Stripe API call fails, keep existing status
                // This prevents errors from breaking the payment listing
            }
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

                // Update payment with Stripe Payment Intent ID and simplified status from Stripe
                payment.StripePaymentIntentId = paymentIntent.Id;
                payment.Status = MapStripeStatusToSimplifiedStatus(paymentIntent.Status);
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

                // Map Stripe status to simplified status (succeeded, incomplete, failed)
                var simplifiedStatus = MapStripeStatusToSimplifiedStatus(paymentIntent.Status);
                payment.Status = simplifiedStatus;
                
                // Capture decline reason if payment failed or incomplete
                if (simplifiedStatus == "failed" || simplifiedStatus == "incomplete")
                {
                    payment.DeclineReason = await ExtractDeclineReasonFromStripe(paymentIntent);
                }
                else
                {
                    // Clear decline reason for succeeded payments
                    payment.DeclineReason = null;
                }
                
                payment.UpdatedAt = DateTime.UtcNow;
                await _paymentCollection.ReplaceOneAsync(p => p.Id == payment.Id, payment);

                if (simplifiedStatus != "succeeded")
                {
                    return BadRequest(new { error = $"Payment not completed. Status: {simplifiedStatus}", declineReason = payment.DeclineReason });
                }

                // Payment succeeded - update payment record
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
                            var simplifiedStatus = MapStripeStatusToSimplifiedStatus(paymentIntent.Status);
                            payment.Status = simplifiedStatus;

                            // Capture decline reason if payment failed or incomplete
                            if (simplifiedStatus == "failed" || simplifiedStatus == "incomplete")
                            {
                                payment.DeclineReason = await ExtractDeclineReasonFromStripe(paymentIntent);
                            }
                            else
                            {
                                payment.DeclineReason = null;
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
                            var simplifiedStatus = MapStripeStatusToSimplifiedStatus(paymentIntent.Status);
                            payment.Status = simplifiedStatus;

                            // Capture decline reason if payment failed or incomplete
                            if (simplifiedStatus == "failed" || simplifiedStatus == "incomplete")
                            {
                                payment.DeclineReason = await ExtractDeclineReasonFromStripe(paymentIntent);
                            }
                            else
                            {
                                payment.DeclineReason = null;
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
                        paidAt = payment.PaidAt
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

