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
        private readonly SummarizationService _summarizationService;

        public UserController(IConfiguration configuration)
        {
            var client = new MongoClient(configuration["MongoDbSettings:ConnectionString"]);
            var database = client.GetDatabase(configuration["MongoDbSettings:DatabaseName"]);

            _userCollection = database.GetCollection<User>("users");
            _roleCollection = database.GetCollection<Role>("roles");
            _userRoleCollection = database.GetCollection<UserRole>("userRoles");
            _usageCollection = database.GetCollection<Usage>("usage");
            
            _summarizationService = new SummarizationService(_userRoleCollection, _usageCollection);
        }

        [AllowAnonymous]
        [HttpGet("count")]
        public async Task<IActionResult> GetUserCount()
        {
            var count = await _userCollection.CountDocumentsAsync(_ => true);
            return Ok(new { count = (int)count });
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
                
                // Only get usage for regular users (role 2), not admins
                if (roleId == 2)
                {
                    var usage = await _usageCollection.Find(u => u.UserId == user.UserId).FirstOrDefaultAsync();
                    result.Add(new
                    {
                        userId = user.UserId,
                        overallUsage = usage?.OverallUsage ?? 0,
                        totalLimit = usage?.TotalLimit ?? 100
                    });
                }
                else
                {
                    // For admins, return 0 usage
                    result.Add(new
                    {
                        userId = user.UserId,
                        overallUsage = 0,
                        totalLimit = 100
                    });
                }
            }

            return Ok(result);
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

            var existing = await _userCollection.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
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
                RefreshToken = null,
                RefreshTokenExpiresAt = null,
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
                .Set(u => u.UpdatedAt, DateTime.UtcNow)
                .Set(u => u.RefreshToken, null)
                .Set(u => u.RefreshTokenExpiresAt, null);

            await _userCollection.UpdateOneAsync(u => u.UserId == id, update);

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
    }
}

