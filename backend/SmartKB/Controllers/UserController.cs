using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using SmartKB.Services;
using System.Security.Cryptography;
using System.Text;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/Users")]
    public class UserController : ControllerBase
    {
        private readonly IMongoCollection<User> _userCollection;
        private readonly IMongoCollection<Role> _roleCollection;
        private readonly IMongoCollection<UserRole> _userRoleCollection;
        private readonly IMongoCollection<Usage> _usageCollection;
        private readonly IMongoCollection<Payment> _paymentCollection;
        private readonly IMongoCollection<Package> _packageCollection;
        private readonly IMongoCollection<RefreshTokenSession> _refreshTokens;
        private readonly SummarizationService _summarizationService;
        private readonly EmailService _emailService;

        public UserController(IConfiguration configuration, EmailService emailService)
        {
            _emailService = emailService;

            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _userCollection = database.GetCollection<User>("users");
            _roleCollection = database.GetCollection<Role>("roles");
            _userRoleCollection = database.GetCollection<UserRole>("userRoles");
            _usageCollection = database.GetCollection<Usage>("usage");
            _paymentCollection = database.GetCollection<Payment>("payments");
            _packageCollection = database.GetCollection<Package>("packages");
            _refreshTokens = database.GetCollection<RefreshTokenSession>("refreshTokens");
            
            _summarizationService = new SummarizationService(_userRoleCollection, _usageCollection);
        }

        [AllowAnonymous]
        [HttpGet("count")]
        public async Task<IActionResult> GetUserCount()
        {
            var count = await _userCollection.CountDocumentsAsync(_ => true);
            return Ok(new { count = (int)count });
        }

        [AllowAnonymous]
        [HttpPost("check-username")]
        public async Task<IActionResult> CheckUsername([FromBody] CheckUsernameDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username))
                return BadRequest("Username is required");

            var existingUsername = await _userCollection.Find(u => u.Username == dto.Username).FirstOrDefaultAsync();
            
            return Ok(new { exists = existingUsername != null });
        }

        [AllowAnonymous]
        [HttpPost("check-email")]
        public async Task<IActionResult> CheckEmail([FromBody] CheckEmailDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email))
                return BadRequest("Email is required");

            var existingEmail = await _userCollection.Find(u => u.Email.ToLower() == dto.Email.ToLower()).FirstOrDefaultAsync();
            
            return Ok(new { exists = existingEmail != null });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/total-users")]
        public async Task<IActionResult> GetTotalUsers()
        {
            var count = await _userCollection.CountDocumentsAsync(_ => true);
            return Ok(new { count = (int)count });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _userCollection.Find(_ => true).ToListAsync();

            var result = new List<object>();
            foreach (var user in users)
            {
                var userRole = await _userRoleCollection.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
                var roleId = userRole?.RoleId ?? 2;
                result.Add(new
                {
                    id = user.UserId,
                    name = user.Username,
                    email = user.Email,
                    role = roleId == 1 ? "admin" : "user",
                    status = user.IsActive ? "active" : "inactive",
                    joinedAt = user.CreatedAt
                });
            }

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/usage")]
        public async Task<IActionResult> GetAllUsersUsage()
        {
            // Get all users
            var users = await _userCollection.Find(_ => true).ToListAsync();
            var result = new List<object>();

            foreach (var user in users)
            {
                // Get user role
                var userRole = await _userRoleCollection.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
                if (userRole == null) continue;

                int roleId = userRole.RoleId;
                
                // Only get usage for regular users (role 2), exclude admins completely
                if (roleId == 2)
                {
                    var usage = await _usageCollection.Find(u => u.UserId == user.UserId).FirstOrDefaultAsync();
                    result.Add(new
                    {
                        userId = user.UserId,
                        userEmail = user.Email,
                        userName = user.Username,
                        overallUsage = usage?.OverallUsage ?? 0,
                        totalLimit = usage?.TotalLimit ?? 100
                    });
                }
                // Skip admins - don't include them in the response
            }

            return Ok(result);
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/avg-usage")]
        public async Task<IActionResult> GetAverageUsagePercentage()
        {
            // Get all users
            var users = await _userCollection.Find(_ => true).ToListAsync();
            var usagePercentages = new List<double>();

            foreach (var user in users)
            {
                // Get user role
                var userRole = await _userRoleCollection.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
                if (userRole == null) continue;

                int roleId = userRole.RoleId;
                
                // Only calculate usage for regular users (role 2), not admins
                if (roleId == 2)
                {
                    var usage = await _usageCollection.Find(u => u.UserId == user.UserId).FirstOrDefaultAsync();
                    var overallUsage = usage?.OverallUsage ?? 0;
                    var totalLimit = usage?.TotalLimit ?? 100;
                    
                    if (totalLimit > 0)
                    {
                        var percentage = Math.Min((double)overallUsage / totalLimit * 100, 100);
                        usagePercentages.Add(percentage);
                    }
                }
            }

            var averagePercentage = usagePercentages.Count > 0
                ? Math.Round(usagePercentages.Average(), 2)
                : 0.0;

            return Ok(new { averagePercentage = averagePercentage });
        }

        [Authorize(Roles = "1")]
        [HttpPost("admin")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email))
                return BadRequest("Email is required");
            if (string.IsNullOrWhiteSpace(dto.Username))
                return BadRequest("Username is required");
            if (string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest("Password is required");

            var existing = await _userCollection.Find(u => u.Email.ToLower() == dto.Email.ToLower()).FirstOrDefaultAsync();
            if (existing != null)
                return BadRequest("Email already exists");

            var existingUsername = await _userCollection.Find(u => u.Username == dto.Username).FirstOrDefaultAsync();
            if (existingUsername != null)
                return BadRequest("Username already exists");

            var saltBytes = RandomNumberGenerator.GetBytes(16);
            var salt = Convert.ToBase64String(saltBytes);

            var hash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.Password + salt))
            );

            var user = new User
            {
                Email = dto.Email,
                Username = dto.Username,
                PasswordHash = hash,
                PasswordSalt = salt,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _userCollection.InsertOneAsync(user);

            // Assign role (default to user role = 2)
            int roleId = 2;
            var role = await _roleCollection.Find(r => r.RoleId == roleId).FirstOrDefaultAsync();
            if (role == null)
                return BadRequest("Role not found in DB: " + roleId);

            var userRole = new UserRole
            {
                UserId = user.UserId,
                RoleId = roleId
            };

            await _userRoleCollection.InsertOneAsync(userRole);

            // Create usage record only for regular users (role 2), not for admins (role 1)
            // Admins have unlimited usage, so they don't need a usage record
            // Note: This CreateUser endpoint always creates regular users (roleId = 2)
            if (roleId == 2)
            {
                var usage = new Usage
                {
                    UserId = user.UserId,
                    OverallUsage = 0,
                    TotalLimit = 100,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _usageCollection.InsertOneAsync(usage);
            }

            return Ok(new
            {
                message = "User created successfully",
                userId = user.UserId
            });
        }

        [Authorize(Roles = "1")]
        [HttpDelete("admin/{id}")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            var user = await _userCollection.Find(u => u.UserId == id).FirstOrDefaultAsync();
            if (user == null)
                return NotFound("User not found");

            // Check if user is admin and prevent deactivation
            var userRole = await _userRoleCollection.Find(ur => ur.UserId == id).FirstOrDefaultAsync();
            if (userRole != null && userRole.RoleId == 1)
                return BadRequest("Cannot deactivate admin users");

            // Set user as inactive instead of deleting
            var update = Builders<User>.Update
                .Set(u => u.IsActive, false)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _userCollection.UpdateOneAsync(u => u.UserId == id, update);
            await _refreshTokens.DeleteManyAsync(rt => rt.UserId == id);

            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendAccountDeactivatedEmailAsync(
                        user.Email,
                        user.Username ?? user.Email);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Deactivate User] [Background] Account deactivation email failed: {ex.Message}");
                }
            });

            return Ok(new { message = "User deactivated successfully" });
        }

        [Authorize(Roles = "1")]
        [HttpPost("admin/{id}/reactivate")]
        public async Task<IActionResult> ReactivateUser(string id)
        {
            var user = await _userCollection.Find(u => u.UserId == id).FirstOrDefaultAsync();
            if (user == null)
                return NotFound("User not found");

            // Set user as active
            var update = Builders<User>.Update
                .Set(u => u.IsActive, true)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _userCollection.UpdateOneAsync(u => u.UserId == id, update);

            // Note: No email sent here - reactivation emails are sent via activation request approval process

            return Ok(new { message = "User reactivated successfully" });
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("usage")]
        public async Task<IActionResult> GetUsage()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            var usage = await _usageCollection.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            
            if (usage == null)
            {
                return Ok(new
                {
                    overallUsage = 0,
                    totalLimit = 100
                });
            }

            return Ok(new
            {
                overallUsage = usage.OverallUsage,
                totalLimit = usage.TotalLimit
            });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateUserProfile([FromBody] UpdateUserDto dto)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;
            var user = await _userCollection.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            
            if (user == null)
                return NotFound("User not found");

            // Check if new username already exists (if provided and different from current)
            if (!string.IsNullOrWhiteSpace(dto.Username) && dto.Username != user.Username)
            {
                var existingUsername = await _userCollection.Find(u => u.Username == dto.Username && u.UserId != userId).FirstOrDefaultAsync();
                if (existingUsername != null)
                    return BadRequest("Username already exists");
            }

            // Check if new email already exists (if provided and different from current)
            if (!string.IsNullOrWhiteSpace(dto.Email) && dto.Email.ToLower() != user.Email.ToLower())
            {
                var existingEmail = await _userCollection.Find(u => u.Email.ToLower() == dto.Email.ToLower() && u.UserId != userId).FirstOrDefaultAsync();
                if (existingEmail != null)
                    return BadRequest("Email already exists");
            }

            // Update user
            var updateBuilder = Builders<User>.Update.Set(u => u.UpdatedAt, DateTime.UtcNow);
            
            if (!string.IsNullOrWhiteSpace(dto.Username))
                updateBuilder = updateBuilder.Set(u => u.Username, dto.Username);
            
            if (!string.IsNullOrWhiteSpace(dto.Email))
                updateBuilder = updateBuilder.Set(u => u.Email, dto.Email);

            await _userCollection.UpdateOneAsync(u => u.UserId == userId, updateBuilder);

            return Ok(new { message = "User profile updated successfully" });
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("profile")]
        public async Task<IActionResult> GetUserProfile()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;
            var user = await _userCollection.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            
            if (user == null)
                return NotFound("User not found");

            return Ok(new
            {
                id = user.UserId,
                username = user.Username,
                email = user.Email,
                createdAt = user.CreatedAt
            });
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet("current-plan")]
        public async Task<IActionResult> GetCurrentPlan()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null)
                return Unauthorized("User ID not found in token.");

            var userId = userIdClaim.Value;

            // Find all succeeded payments with a package
            var payments = await _paymentCollection
                .Find(p => p.UserId == userId && p.Status == "succeeded" && !string.IsNullOrEmpty(p.PackageId))
                .ToListAsync();

            // Sort in memory by PaidAt (if exists) or CreatedAt, then get the most recent
            var payment = payments
                .OrderByDescending(p => p.PaidAt ?? p.CreatedAt)
                .FirstOrDefault();

            if (payment == null || string.IsNullOrEmpty(payment.PackageId))
            {
                // No payment found, return Free Plan
                return Ok(new
                {
                    planName = "Free Plan",
                    packageId = (string?)null
                });
            }

            // Get the package details
            var package = await _packageCollection
                .Find(p => p.PackageId == payment.PackageId)
                .FirstOrDefaultAsync();

            if (package == null)
            {
                return Ok(new
                {
                    planName = "Free Plan",
                    packageId = (string?)null
                });
            }

            return Ok(new
            {
                planName = $"{package.Name} Plan",
                packageId = package.PackageId,
                packageName = package.Name
            });
        }
    }
}

