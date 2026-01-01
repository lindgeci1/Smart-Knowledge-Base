using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using SmartKB.Services;
using System.Linq;
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
        private readonly IMongoCollection<PasswordResetToken> _passwordResetTokens;
        private readonly IMongoCollection<Usage> _usage;
        private readonly IConfiguration _config;
        private readonly EmailService _emailService;

        public AuthController(IConfiguration config, EmailService emailService)
        {
            _config = config;
            _emailService = emailService;

            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? config["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? config["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var db = client.GetDatabase(databaseName);

            _users = db.GetCollection<User>("users");
            _roles = db.GetCollection<Role>("roles");
            _userRoles = db.GetCollection<UserRole>("userRoles");
            _passwordResetTokens = db.GetCollection<PasswordResetToken>("passwordResetTokens");
            _usage = db.GetCollection<Usage>("usage");
        }


        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            // Console.WriteLine($"[Register] Starting registration for email: {dto.Email}, username: {dto.Username}");

            if (string.IsNullOrWhiteSpace(dto.Username))
            {
                // Console.WriteLine($"[Register] Registration failed - Username is required");
                return BadRequest("Username is required");
            }

            // Console.WriteLine($"[Register] Checking if email already exists...");
            var existing = await _users.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
            if (existing != null)
            {
                // Console.WriteLine($"[Register] Registration failed - Email already exists: {dto.Email}");
                return BadRequest("Email already exists");
            }

            // Console.WriteLine($"[Register] Generating password salt and hash...");
            var saltBytes = RandomNumberGenerator.GetBytes(16);
            var salt = Convert.ToBase64String(saltBytes);

            var hash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.Password + salt))
            );

            // Console.WriteLine($"[Register] Checking if this is the first user...");
            bool firstUser = !(await _users.Find(_ => true).AnyAsync());
            // Console.WriteLine($"[Register] Is first user: {firstUser}");

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

            // Console.WriteLine($"[Register] Inserting user into database...");
            await _users.InsertOneAsync(user);
            Console.WriteLine($"[Register] User inserted with UserId: {user.UserId}");

            int roleId = firstUser ? 1 : 2;
                // Console.WriteLine($"[Register] Assigning role ID: {roleId} ({(firstUser ? "Admin" : "User")})");

            var role = await _roles.Find(r => r.RoleId == roleId).FirstOrDefaultAsync();
            if (role == null)
            {
                // Console.WriteLine($"[Register] Registration failed - Role not found: {roleId}");
                return BadRequest("Role not found in DB: " + roleId);
            }

            var userRole = new UserRole
            {
                UserId = user.UserId,
                RoleId = roleId
            };

            // Console.WriteLine($"[Register] Creating user role assignment...");
            await _userRoles.InsertOneAsync(userRole);
            //Console.WriteLine($"[Register] Registration successful - UserId: {user.UserId}, Role: {roleId}, Message: {(firstUser ? "Admin created" : "User registered")}");

            // Create usage record only for regular users (role 2), not for admins (role 1)
            // Admins have unlimited usage, so they don't need a usage record
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
                await _usage.InsertOneAsync(usage);
            }

            // Send welcome email asynchronously (fire-and-forget) to avoid blocking the response
            // Console.WriteLine($"[Register] Queuing welcome email to send asynchronously...");
            _ = Task.Run(async () =>
            {
                try
                {
                    // Console.WriteLine($"[Register] [Background] Sending welcome email to: {dto.Email}");
                    await _emailService.SendWelcomeEmailAsync(dto.Email, dto.Username);
                    // Console.WriteLine($"[Register] [Background] Welcome email sent successfully to: {dto.Email}");
                }
                catch (Exception ex)
                {
                    // Console.WriteLine($"[Register] [Background] Welcome email sending failed: {ex.Message}");
                    // Silently fail - we don't want to block registration if email fails
                }
            });

            return Ok(new
            {
                message = firstUser ? "Admin created" : "User registered",
                userId = user.UserId,
            });
        }
        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            // Console.WriteLine($"[Login] Login attempt for email: {dto.Email}");

            // Console.WriteLine($"[Login] Looking up user by email...");
            var user = await _users.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
            if (user == null)
            {
                // Console.WriteLine($"[Login] Login failed - User not found for email: {dto.Email}");
                return Unauthorized("Invalid email or password");
            }

            // Console.WriteLine($"[Login] User found - UserId: {user.UserId}, Username: {user.Username}");

            // Check if user is active
            if (!user.IsActive)
            {
                // Console.WriteLine($"[Login] Login failed - User is inactive: {user.UserId}");
                return Unauthorized("Your account has been deactivated. Please contact an administrator.");
            }

            // Console.WriteLine($"[Login] Verifying password...");
            var hash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.Password + user.PasswordSalt))
            );

            if (hash != user.PasswordHash)
            {
                // Console.WriteLine($"[Login] Login failed - Invalid password for user: {user.UserId}");
                return Unauthorized("Invalid email or password");
            }

            // Console.WriteLine($"[Login] Password verified successfully");

            // Console.WriteLine($"[Login] Looking up user role...");
            var userRole = await _userRoles.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
            if (userRole == null)
            {
                // Console.WriteLine($"[Login] Login failed - No role assigned for user: {user.UserId}");
                return Unauthorized("User has no role assigned");
            }

            int roleId = userRole.RoleId;
            // Console.WriteLine($"[Login] User role found - RoleId: {roleId}");

            string jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
                ?? throw new Exception("Missing JWT_KEY in .env");

            int jwtExpireMinutes = 15;

            //  Console.WriteLine($"[Login] Generating JWT token...");
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
            // Console.WriteLine($"[Login] JWT token generated - Expires in {jwtExpireMinutes} minutes");

            // Console.WriteLine($"[Login] Generating refresh token...");
            string refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            DateTime refreshExpires = DateTime.UtcNow.AddDays(1);

            var update = Builders<User>.Update
                .Set(u => u.RefreshToken, refreshToken)
                .Set(u => u.RefreshTokenExpiresAt, refreshExpires)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            // Console.WriteLine($"[Login] Updating user with refresh token...");
            await _users.UpdateOneAsync(u => u.UserId == user.UserId, update);

            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Expires = refreshExpires
            });

            // Console.WriteLine($"[Login] Login successful - UserId: {user.UserId}, RoleId: {roleId}, Refresh token expires: {refreshExpires}");

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

        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            // Console.WriteLine($"[Forgot Password] Password reset request for email: {dto.Email}");

            if (string.IsNullOrWhiteSpace(dto.Email))
            {
                Console.WriteLine($"[Forgot Password] Request failed - Email is required");
                return BadRequest("Email is required");
            }

            // Check if user exists (but don't reveal if they don't for security)
            // Console.WriteLine($"[Forgot Password] Looking up user by email...");
            var user = await _users.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
            
            if (user == null)
            {
                Console.WriteLine($"[Forgot Password] User not found for email: {dto.Email} (returning success for security)");
                // Return success even if user doesn't exist to prevent email enumeration
                return Ok(new { message = "If an account exists with that email, a reset code has been sent." });
            }

            // Console.WriteLine($"[Forgot Password] User found - UserId: {user.UserId}, Username: {user.Username}");

            // Check if user is active
            if (!user.IsActive)
            {
                Console.WriteLine($"[Forgot Password] User is inactive: {user.UserId} (returning success for security)");
                return Ok(new { message = "If an account exists with that email, a reset code has been sent." });
            }

            // Check if UserId is set (it should be populated from MongoDB _id)
            if (string.IsNullOrEmpty(user.UserId))
            {
                Console.WriteLine($"[Forgot Password] UserId is null for user: {dto.Email} (returning success for security)");
                return Ok(new { message = "If an account exists with that email, a reset code has been sent." });
            }

            // Generate 6-digit code
            // Console.WriteLine($"[Forgot Password] Generating 6-digit reset code...");
            var random = new Random();
            var code = random.Next(100000, 999999).ToString();
            // Console.WriteLine($"[Forgot Password] Reset code generated: {code}");

            // Set expiration to 5 minutes from now
            var expiresAt = DateTime.UtcNow.AddMinutes(5);
            // Console.WriteLine($"[Forgot Password] Code expires at: {expiresAt}");

            // Invalidate ALL existing tokens for this user (both used and unused)
            // This ensures that when a new code is requested, all previous codes become invalid
            // Console.WriteLine($"[Forgot Password] Invalidating existing tokens for user: {user.UserId}");
            var updateExisting = Builders<PasswordResetToken>.Update
                .Set(t => t.IsUsed, true);
            var invalidatedCount = await _passwordResetTokens.UpdateManyAsync(
                t => t.UserId == user.UserId,
                updateExisting
            );
            // Console.WriteLine($"[Forgot Password] Invalidated {invalidatedCount.ModifiedCount} existing token(s)");

            // Check if UserId is set (it should be populated from MongoDB _id)
            if (string.IsNullOrEmpty(user.UserId))
            {
                // Console.WriteLine($"[Forgot Password] UserId is null (duplicate check) - returning success for security");
                return Ok(new { message = "If an account exists with that email, a reset code has been sent." });
            }

            // Create new reset token
            // Console.WriteLine($"[Forgot Password] Creating new reset token...");
            var resetToken = new PasswordResetToken
            {
                UserId = user.UserId,
                Token = code,
                ExpiresAt = expiresAt,
                IsUsed = false,
                CreatedAt = DateTime.UtcNow
            };

            try
            {
                // Console.WriteLine($"[Forgot Password] Inserting token into database...");
                await _passwordResetTokens.InsertOneAsync(resetToken);
                // Console.WriteLine($"[Forgot Password] Token inserted successfully - TokenId: {resetToken.Id}");
            }
            catch (Exception ex)
            {
                // Console.WriteLine($"[Forgot Password] Token insertion failed: {ex.Message}");
                return Ok(new { message = "If an account exists with that email, a reset code has been sent." });
            }

            // Send email with reset code asynchronously (fire-and-forget) to avoid blocking the response
            // Console.WriteLine($"[Forgot Password] Queuing email to send asynchronously...");
            _ = Task.Run(async () =>
            {
                try
                {
                    // Console.WriteLine($"[Forgot Password] [Background] Sending email to: {dto.Email}");
                    await _emailService.SendPasswordResetEmailAsync(dto.Email, code);
                    // Console.WriteLine($"[Forgot Password] [Background] Email sent successfully to: {dto.Email}");
                }
                catch (Exception ex)
                {
                    // Console.WriteLine($"[Forgot Password] [Background] Email sending failed: {ex.Message}");
                    // Silently fail - we don't want to reveal if email sending failed
                }
            });

            // Console.WriteLine($"[Forgot Password] Request completed successfully - Reset code sent to: {dto.Email}");
            return Ok(new { message = "If an account exists with that email, a reset code has been sent." });
        }

        [HttpPost("verify-reset-code")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyResetCode([FromBody] VerifyResetCodeDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Code))
                return BadRequest("Email and code are required");

            var user = await _users.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
            if (user == null)
                return BadRequest("Invalid email or code");

            // Check if code is 6 digits
            if (dto.Code.Length != 6 || !dto.Code.All(char.IsDigit))
                return BadRequest("Invalid code format. Code must be 6 digits.");

            // First, find any token with this code for this user (including used ones)
            var token = await _passwordResetTokens
                .Find(t => t.UserId == user.UserId && t.Token == dto.Code)
                .FirstOrDefaultAsync();

            if (token == null)
                return BadRequest("Invalid code. Please check the code and try again.");

            // Check if token is already used
            if (token.IsUsed)
                return BadRequest("This reset code has already been used. Please request a new code.");

            // Check if token has expired
            if (token.ExpiresAt < DateTime.UtcNow)
                return BadRequest("Reset code has expired. Please request a new one.");

            return Ok(new { valid = true, message = "Code verified successfully" });
        }

        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.NewPassword))
            {
                return BadRequest("Email, code, and new password are required");
            }

            if (dto.NewPassword.Length < 6)
            {
                return BadRequest("Password must be at least 6 characters long");
            }

            var user = await _users.Find(u => u.Email == dto.Email).FirstOrDefaultAsync();
            if (user == null)
            {
                return BadRequest("Invalid email or code");
            }

            var token = await _passwordResetTokens
                .Find(t => t.UserId == user.UserId && t.Token == dto.Code && !t.IsUsed)
                .FirstOrDefaultAsync();

            if (token == null)
            {
                return BadRequest("Invalid code");
            }

            if (token.ExpiresAt < DateTime.UtcNow)
            {
                return BadRequest("Reset code has expired. Please request a new one.");
            }

            // Check if the new password is the same as the current password
            var currentHash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.NewPassword + user.PasswordSalt))
            );
            
            if (currentHash == user.PasswordHash)
            {
                // Don't mark token as used - let user try again with a different password
                return BadRequest("New password cannot be the same as your current password. Please choose a different password.");
            }

            // Generate new salt and hash for the password
            var saltBytes = RandomNumberGenerator.GetBytes(16);
            var salt = Convert.ToBase64String(saltBytes);
            var hash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.NewPassword + salt))
            );

            // Update user password
            var updateUser = Builders<User>.Update
                .Set(u => u.PasswordHash, hash)
                .Set(u => u.PasswordSalt, salt)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _users.UpdateOneAsync(u => u.UserId == user.UserId, updateUser);

            // Mark token as used
            var updateToken = Builders<PasswordResetToken>.Update
                .Set(t => t.IsUsed, true);
            await _passwordResetTokens.UpdateOneAsync(t => t.Id == token.Id, updateToken);

            // Send password changed email asynchronously (fire-and-forget) to avoid blocking the response
            Console.WriteLine($"[Reset Password] Queuing password changed email to send asynchronously...");
            _ = Task.Run(async () =>
            {
                try
                {
                    Console.WriteLine($"[Reset Password] [Background] Sending password changed email to: {dto.Email}");
                    await _emailService.SendPasswordChangedEmailAsync(dto.Email, user.Username ?? dto.Email);
                    Console.WriteLine($"[Reset Password] [Background] Password changed email sent successfully to: {dto.Email}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Reset Password] [Background] Password changed email sending failed: {ex.Message}");
                    // Silently fail - we don't want to block password reset if email fails
                }
            });

            return Ok(new { message = "Password reset successfully" });
        }





    }
}
