using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using SmartKB.Services;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/Activation")]
    public class ActivationController : ControllerBase
    {
        private readonly IMongoCollection<ActivationRequest> _activationCollection;
        private readonly IMongoCollection<User> _userCollection;
        private readonly EmailService _emailService;

        public ActivationController(IConfiguration configuration, EmailService emailService)
        {
            _emailService = emailService;
            
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _activationCollection = database.GetCollection<ActivationRequest>("activationRequests");
            _userCollection = database.GetCollection<User>("users");
        }

        [AllowAnonymous]
        [HttpPost("request")]
        public async Task<IActionResult> RequestActivation([FromBody] RequestActivationDto dto)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage)
                    .ToList();
                return BadRequest(string.Join("; ", errors));
            }

            // Check if user exists with this email
            var user = await _userCollection.Find(u => u.Email == dto.Email.Trim()).FirstOrDefaultAsync();
            
            // Check if there's already a pending request for this email
            var existingRequest = await _activationCollection
                .Find(ar => ar.Email == dto.Email.Trim() && ar.Status == "pending")
                .FirstOrDefaultAsync();

            if (existingRequest != null)
                return BadRequest("You already have a pending activation request. Please wait for admin approval.");

            var activationRequest = new ActivationRequest
            {
                Email = dto.Email.Trim(),
                Username = null,
                Message = null,
                Status = "pending",
                UserId = user?.UserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _activationCollection.InsertOneAsync(activationRequest);

            // Send email notification in background
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendActivationRequestReceivedEmailAsync(
                        dto.Email,
                        null);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Activation Request] [Background] Email notification failed: {ex.Message}");
                }
            });

            return Ok(new { 
                message = "Activation request submitted successfully. An admin will review your request.",
                requestId = activationRequest.ActivationId
            });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin")]
        public async Task<IActionResult> GetAllActivationRequests()
        {
            var requests = await _activationCollection
                .Find(_ => true)
                .SortByDescending(r => r.CreatedAt)
                .ToListAsync();

            var result = requests.Select(r => new
            {
                id = r.ActivationId,
                email = r.Email,
                status = r.Status,
                userId = r.UserId,
                createdAt = r.CreatedAt,
                updatedAt = r.UpdatedAt,
                processedAt = r.ProcessedAt
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/pending")]
        public async Task<IActionResult> GetPendingActivationRequests()
        {
            var requests = await _activationCollection
                .Find(r => r.Status == "pending")
                .SortByDescending(r => r.CreatedAt)
                .ToListAsync();

            var result = requests.Select(r => new
            {
                id = r.ActivationId,
                email = r.Email,
                status = r.Status,
                userId = r.UserId,
                createdAt = r.CreatedAt,
                updatedAt = r.UpdatedAt
            }).ToList();

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpPost("admin/{id}/approve")]
        public async Task<IActionResult> ApproveActivationRequest(string id)
        {
            var request = await _activationCollection.Find(r => r.ActivationId == id).FirstOrDefaultAsync();
            if (request == null)
                return NotFound("Activation request not found");

            if (request.Status != "pending")
                return BadRequest("This request has already been processed");

            // If user exists, reactivate them
            if (!string.IsNullOrEmpty(request.UserId))
            {
                var user = await _userCollection.Find(u => u.UserId == request.UserId).FirstOrDefaultAsync();
                if (user != null)
                {
                    var update = Builders<User>.Update
                        .Set(u => u.IsActive, true)
                        .Set(u => u.UpdatedAt, DateTime.UtcNow);

                    await _userCollection.UpdateOneAsync(u => u.UserId == request.UserId, update);
                }
            }

            // Update request status
            var updateRequest = Builders<ActivationRequest>.Update
                .Set(r => r.Status, "approved")
                .Set(r => r.UpdatedAt, DateTime.UtcNow)
                .Set(r => r.ProcessedAt, DateTime.UtcNow);

            await _activationCollection.UpdateOneAsync(r => r.ActivationId == id, updateRequest);

            // Send email notification in background
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendActivationRequestApprovedEmailAsync(
                        request.Email,
                        null);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Approve Activation Request] [Background] Email notification failed: {ex.Message}");
                }
            });

            return Ok(new { message = "Activation request approved successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpPost("admin/{id}/reject")]
        public async Task<IActionResult> RejectActivationRequest(string id)
        {
            var request = await _activationCollection.Find(r => r.ActivationId == id).FirstOrDefaultAsync();
            if (request == null)
                return NotFound("Activation request not found");

            if (request.Status != "pending")
                return BadRequest("This request has already been processed");

            // Update request status
            var update = Builders<ActivationRequest>.Update
                .Set(r => r.Status, "rejected")
                .Set(r => r.UpdatedAt, DateTime.UtcNow)
                .Set(r => r.ProcessedAt, DateTime.UtcNow);

            await _activationCollection.UpdateOneAsync(r => r.ActivationId == id, update);

            // Send email notification in background
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendActivationRequestRejectedEmailAsync(
                        request.Email,
                        null);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Reject Activation Request] [Background] Email notification failed: {ex.Message}");
                }
            });

            return Ok(new { message = "Activation request rejected successfully" });
        }
    }
}

