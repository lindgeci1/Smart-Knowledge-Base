using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using System.Security.Cryptography;
using System.Text;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IMongoCollection<User> _users;
        private readonly IMongoCollection<Role> _roles;
        private readonly IMongoCollection<UserRole> _userRoles;
        private readonly IConfiguration _config;

        public AuthController(IConfiguration config)
        {
            _config = config;

            var client = new MongoClient(config["MongoDbSettings:ConnectionString"]);
            var db = client.GetDatabase(config["MongoDbSettings:DatabaseName"]);

            _users = db.GetCollection<User>("users");
            _roles = db.GetCollection<Role>("roles");
            _userRoles = db.GetCollection<UserRole>("userRoles");
        }


        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username))
                return BadRequest("Username is required");

            var existing = await _users.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
            if (existing != null)
                return BadRequest("Email already exists");

            var saltBytes = RandomNumberGenerator.GetBytes(16);
            var salt = Convert.ToBase64String(saltBytes);

            var hash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.Password + salt))
            );

            bool firstUser = !(await _users.Find(_ => true).AnyAsync());

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

            await _users.InsertOneAsync(user);

            int roleId = firstUser ? 1 : 2;

            var role = await _roles.Find(r => r.RoleId == roleId).FirstOrDefaultAsync();
            if (role == null)
                return BadRequest("Role not found in DB: " + roleId);

            var userRole = new UserRole
            {
                UserId = user.UserId,
                RoleId = roleId
            };

            await _userRoles.InsertOneAsync(userRole);

            return Ok(new
            {
                message = firstUser ? "Admin created" : "User registered",
                userId = user.UserId,
            });
        }
        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var user = await _users.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
            if (user == null)
                return Unauthorized("Invalid email or password");

            // Check if user is active
            if (!user.IsActive)
                return Unauthorized("Your account has been deactivated. Please contact an administrator.");

            var hash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.Password + user.PasswordSalt))
            );

            if (hash != user.PasswordHash)
                return Unauthorized("Invalid email or password");

            var userRole = await _userRoles.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
            if (userRole == null)
                return Unauthorized("User has no role assigned");

            int roleId = userRole.RoleId;

            string jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
                ?? throw new Exception("Missing JWT_KEY in .env");

            int jwtExpireMinutes = 15;

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
        new Claim("userId", user.UserId),
        new Claim("username", user.Username ?? ""),
        new Claim(ClaimTypes.Role, roleId.ToString())
    };

            var jwtToken = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(jwtExpireMinutes),
                signingCredentials: creds
            );

            string jwt = new JwtSecurityTokenHandler().WriteToken(jwtToken);

            string refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            DateTime refreshExpires = DateTime.UtcNow.AddDays(1);

            var update = Builders<User>.Update
                .Set(u => u.RefreshToken, refreshToken)
                .Set(u => u.RefreshTokenExpiresAt, refreshExpires)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _users.UpdateOneAsync(u => u.UserId == user.UserId, update);

            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Expires = refreshExpires
            });

            return Ok(new
            {
                Jwt = jwt
            });
        }


        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            // 1. Read refresh token from HttpOnly cookie
            string refreshToken = Request.Cookies["refreshToken"];

            if (!string.IsNullOrEmpty(refreshToken))
            {
                // 2. Revoke ONLY that session (if it exists)
                var update = Builders<User>.Update
                    .Set(u => u.RefreshToken, null)
                    .Set(u => u.RefreshTokenExpiresAt, null)
                    .Set(u => u.UpdatedAt, DateTime.UtcNow);

                await _users.UpdateOneAsync(
                    u => u.RefreshToken == refreshToken,
                    update
                );
            }

            // 3. Always clear cookies (even if token was missing/expired)
            Response.Cookies.Delete("refreshToken");

            return Ok(new { message = "Logged out" });
        }



        [HttpPost("renew")]
        public async Task<IActionResult> RenewToken()
        {
            string refreshToken = Request.Cookies["refreshToken"];
            if (string.IsNullOrEmpty(refreshToken))
                return Unauthorized("Missing refresh token cookie");

            var user = await _users.Find(u => u.RefreshToken == refreshToken).FirstOrDefaultAsync();
            if (user == null)
                return Unauthorized("Invalid refresh token");

            // Check if user is active
            if (!user.IsActive)
                return Unauthorized("Your account has been deactivated. Please contact an administrator.");

            if (user.RefreshTokenExpiresAt == null || user.RefreshTokenExpiresAt < DateTime.UtcNow)
                return Unauthorized("Refresh token expired");

            var userRole = await _userRoles.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
            if (userRole == null)
                return Unauthorized("User has no role assigned");

            int roleId = userRole.RoleId;

            string jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
                ?? throw new Exception("Missing JWT_KEY in .env");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
        new Claim("userId", user.UserId),
        new Claim("username", user.Username ?? ""),
        new Claim(ClaimTypes.Role, roleId.ToString())
    };

            var jwtToken = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(15),
                signingCredentials: creds
            );

            string newJwt = new JwtSecurityTokenHandler().WriteToken(jwtToken);

            return Ok(new { Jwt = newJwt });
        }





    }
}
