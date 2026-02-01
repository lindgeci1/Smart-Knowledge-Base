using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.DTOs;
using SmartKB.Models;
using SmartKB.Services;
using System.Linq;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using OtpNet;

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
        private readonly IMongoCollection<RefreshTokenSession> _refreshTokens;
        private readonly IConfiguration _config;
        private readonly EmailService _emailService;
        private readonly IHttpClientFactory _httpClientFactory;

        public AuthController(IConfiguration config, EmailService emailService, IHttpClientFactory httpClientFactory)
        {
            _config = config;
            _emailService = emailService;
            _httpClientFactory = httpClientFactory;

            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? config["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? config["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var db = client.GetDatabase(databaseName);

            _users = db.GetCollection<User>("users");
            _roles = db.GetCollection<Role>("roles");
            _userRoles = db.GetCollection<UserRole>("userRoles");
            _passwordResetTokens = db.GetCollection<PasswordResetToken>("passwordResetTokens");
            _usage = db.GetCollection<Usage>("usage");
            _refreshTokens = db.GetCollection<RefreshTokenSession>("refreshTokens");
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
            var existing = await _users.Find(u => u.Email.ToLower() == dto.Email.ToLower()).FirstOrDefaultAsync();
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
            var user = await _users.Find(u => u.Email.ToLower() == dto.Email.ToLower()).FirstOrDefaultAsync();
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

            // Google-only accounts have no password; direct them to Sign in with Google
            if (string.IsNullOrEmpty(user.PasswordHash) || string.IsNullOrEmpty(user.PasswordSalt))
            {
                return Unauthorized("This account uses Sign in with Google. Please use the Sign in with Google button.");
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

            // If 2FA is enabled, return temp token and require TOTP step; do not issue JWT yet
            if (user.TwoFactorEnabled)
            {
                var tempKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
                var tempCreds = new SigningCredentials(tempKey, SecurityAlgorithms.HmacSha256);
                var tempClaims = new[]
                {
                    new Claim("userId", user.UserId ?? ""),
                    new Claim("2fa_pending", "1")
                };
                var tempToken = new JwtSecurityToken(
                    claims: tempClaims,
                    expires: DateTime.UtcNow.AddMinutes(5),
                    signingCredentials: tempCreds
                );
                string tempTokenString = new JwtSecurityTokenHandler().WriteToken(tempToken);
                return Ok(new
                {
                    requiresTwoFactor = true,
                    tempToken = tempTokenString
                });
            }

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

            var refreshTokenRecord = new RefreshTokenSession
            {
                UserId = user.UserId ?? throw new InvalidOperationException("UserId is missing"),
                Token = refreshToken,
                ExpiresAt = refreshExpires,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Console.WriteLine($"[Login] Saving refresh token session...");
            await _refreshTokens.InsertOneAsync(refreshTokenRecord);

            // Use SameSite.Lax now that Vercel proxy makes this same-site request
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = refreshExpires,
                Path = "/"
            });

            // Console.WriteLine($"[Login] Login successful - UserId: {user.UserId}, RoleId: {roleId}, Refresh token expires: {refreshExpires}");

            return Ok(new
            {
                Jwt = jwt
            });
        }

        [HttpPost("google")]
        public async Task<IActionResult> GoogleSignIn([FromBody] GoogleLoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.IdToken))
                return BadRequest("Google ID token is required.");

            // Prefer local OAuth app when running locally; use global (Render) when *_LOCAL not set
            string? googleClientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID_LOCAL")
                ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID")
                ?? _config["Google:ClientId"];
            if (string.IsNullOrEmpty(googleClientId))
                return StatusCode(500, "Google sign-in is not configured (GOOGLE_CLIENT_ID missing).");

            GoogleJsonWebSignature.Payload payload;
            try
            {
                var validationSettings = new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { googleClientId.Trim() }
                };
                payload = await GoogleJsonWebSignature.ValidateAsync(dto.IdToken, validationSettings);
            }
            catch (InvalidJwtException)
            {
                return Unauthorized("Invalid or expired Google sign-in. Please try again.");
            }

            string email = (payload.Email ?? "").Trim().ToLower();
            string googleSub = payload.Subject ?? "";

            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(googleSub))
                return BadRequest("Google account email or id missing.");

            // 1) Find by Google id (already linked)
            var user = await _users.Find(u => u.GoogleId == googleSub).FirstOrDefaultAsync();

            // 2) If not found, find by email (link to existing account)
            if (user == null)
            {
                user = await _users.Find(u => u.Email != null && u.Email.ToLower() == email).FirstOrDefaultAsync();
                if (user != null)
                {
                    await _users.UpdateOneAsync(
                        Builders<User>.Filter.Eq(u => u.UserId, user.UserId),
                        Builders<User>.Update.Set(u => u.GoogleId, googleSub).Set(u => u.UpdatedAt, DateTime.UtcNow)
                    );
                    user.GoogleId = googleSub;
                }
            }

            // 3) If not found, create new user (Register with Google)
            if (user == null)
            {
                bool firstUser = !(await _users.Find(_ => true).AnyAsync());
                int roleId = firstUser ? 1 : 2;
                string username = !string.IsNullOrEmpty(payload.Name) ? payload.Name : email.Split('@')[0];
                username = username.Length > 50 ? username.Substring(0, 50) : username;
                if (string.IsNullOrWhiteSpace(username)) username = "user";

                user = new User
                {
                    Email = email,
                    Username = username,
                    PasswordHash = null,
                    PasswordSalt = null,
                    GoogleId = googleSub,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _users.InsertOneAsync(user);

                var role = await _roles.Find(r => r.RoleId == roleId).FirstOrDefaultAsync();
                if (role == null)
                    return BadRequest("Role not found in DB: " + roleId);

                await _userRoles.InsertOneAsync(new UserRole { UserId = user.UserId, RoleId = roleId });

                if (roleId == 2)
                {
                    await _usage.InsertOneAsync(new Usage
                    {
                        UserId = user.UserId,
                        OverallUsage = 0,
                        TotalLimit = 100,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
            }

            if (!user.IsActive)
                return Unauthorized("Your account has been deactivated. Please contact an administrator.");

            var userRole = await _userRoles.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
            if (userRole == null)
                return Unauthorized("User has no role assigned.");
            int roleIdForJwt = userRole.RoleId;

            string jwtKey = Environment.GetEnvironmentVariable("JWT_KEY") ?? throw new Exception("Missing JWT_KEY");
            int jwtExpireMinutes = 15;
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims = new[]
            {
                new Claim("userId", user.UserId ?? ""),
                new Claim("username", user.Username ?? ""),
                new Claim(ClaimTypes.Role, roleIdForJwt.ToString())
            };
            var jwtToken = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(jwtExpireMinutes),
                signingCredentials: creds
            );
            string jwt = new JwtSecurityTokenHandler().WriteToken(jwtToken);

            string refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            DateTime refreshExpires = DateTime.UtcNow.AddDays(1);
            await _refreshTokens.InsertOneAsync(new RefreshTokenSession
            {
                UserId = user.UserId,
                Token = refreshToken,
                ExpiresAt = refreshExpires,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = refreshExpires,
                Path = "/"
            });

            return Ok(new { Jwt = jwt, email = user.Email });
        }

        [HttpPost("github")]
        public async Task<IActionResult> GitHubSignIn([FromBody] GitHubLoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.RedirectUri))
                return BadRequest("GitHub code and redirect URI are required.");

            // Prefer local OAuth app when running locally; use global (Render) when *_LOCAL not set
            string? clientId = Environment.GetEnvironmentVariable("GITHUB_CLIENT_ID_LOCAL")
                ?? Environment.GetEnvironmentVariable("GITHUB_CLIENT_ID")
                ?? _config["GitHub:ClientId"];
            string? clientSecret = Environment.GetEnvironmentVariable("GITHUB_CLIENT_SECRET_LOCAL")
                ?? Environment.GetEnvironmentVariable("GITHUB_CLIENT_SECRET")
                ?? _config["GitHub:ClientSecret"];
            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
                return StatusCode(500, "GitHub sign-in is not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET missing).");

            var http = _httpClientFactory.CreateClient();
            http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            http.DefaultRequestHeaders.UserAgent.ParseAdd("SmartKB");

            // Exchange code for access token (GitHub returns 200 with body containing either access_token or error)
            var tokenRequest = new { client_id = clientId.Trim(), client_secret = clientSecret.Trim(), code = dto.Code.Trim(), redirect_uri = dto.RedirectUri.Trim() };
            var tokenResponse = await http.PostAsJsonAsync("https://github.com/login/oauth/access_token", tokenRequest);
            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
            using var tokenDoc = JsonDocument.Parse(tokenJson);
            var root = tokenDoc.RootElement;
            if (root.TryGetProperty("error", out var errEl))
            {
                var errDesc = root.TryGetProperty("error_description", out var descEl) ? descEl.GetString() : null;
                var msg = !string.IsNullOrEmpty(errDesc) ? errDesc : (errEl.GetString() ?? "GitHub sign-in failed.");
                return Unauthorized(msg);
            }
            if (!root.TryGetProperty("access_token", out var accessTokenEl))
                return Unauthorized("GitHub did not return an access token. Please try again.");
            string accessToken = accessTokenEl.GetString() ?? "";

            // Get GitHub user
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            var userResponse = await http.GetAsync("https://api.github.com/user");
            userResponse.EnsureSuccessStatusCode();
            var userJson = await userResponse.Content.ReadAsStringAsync();
            using var userDoc = JsonDocument.Parse(userJson);
            var userRoot = userDoc.RootElement;
            string githubId = userRoot.TryGetProperty("id", out var idEl) ? idEl.GetRawText() : "";
            string? name = userRoot.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
            string? login = userRoot.TryGetProperty("login", out var loginEl) ? loginEl.GetString() : null;
            string? userEmail = userRoot.TryGetProperty("email", out var emailEl) ? emailEl.GetString() : null;

            // Get primary verified email if user endpoint didn't return one
            string email = (userEmail ?? "").Trim().ToLower();
            if (string.IsNullOrEmpty(email))
            {
                var emailsResponse = await http.GetAsync("https://api.github.com/user/emails");
                if (emailsResponse.IsSuccessStatusCode)
                {
                    var emailsJson = await emailsResponse.Content.ReadAsStringAsync();
                    using var emailsDoc = JsonDocument.Parse(emailsJson);
                    foreach (var item in emailsDoc.RootElement.EnumerateArray())
                    {
                        bool primary = item.TryGetProperty("primary", out var p) && p.GetBoolean();
                        bool verified = item.TryGetProperty("verified", out var v) && v.GetBoolean();
                        if (verified && item.TryGetProperty("email", out var e))
                        {
                            string em = e.GetString() ?? "";
                            if (primary) { email = em.Trim().ToLower(); break; }
                            if (string.IsNullOrEmpty(email)) email = em.Trim().ToLower();
                        }
                    }
                }
            }

            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(githubId))
                return BadRequest("GitHub account email or id missing. Ensure you grant user:email scope.");

            // 1) Find by GitHub id
            var user = await _users.Find(u => u.GitHubId == githubId).FirstOrDefaultAsync();

            // 2) Find by email (link)
            if (user == null)
            {
                user = await _users.Find(u => u.Email != null && u.Email.ToLower() == email).FirstOrDefaultAsync();
                if (user != null)
                {
                    await _users.UpdateOneAsync(
                        Builders<User>.Filter.Eq(u => u.UserId, user.UserId),
                        Builders<User>.Update.Set(u => u.GitHubId, githubId).Set(u => u.UpdatedAt, DateTime.UtcNow)
                    );
                    user.GitHubId = githubId;
                }
            }

            // 3) Create new user
            if (user == null)
            {
                bool firstUser = !(await _users.Find(_ => true).AnyAsync());
                int roleId = firstUser ? 1 : 2;
                string username = !string.IsNullOrWhiteSpace(name) ? name : (!string.IsNullOrWhiteSpace(login) ? login! : email.Split('@')[0]);
                if (username.Length > 50) username = username.Substring(0, 50);
                if (string.IsNullOrWhiteSpace(username)) username = "user";

                user = new User
                {
                    Email = email,
                    Username = username,
                    PasswordHash = null,
                    PasswordSalt = null,
                    GitHubId = githubId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _users.InsertOneAsync(user);

                var role = await _roles.Find(r => r.RoleId == roleId).FirstOrDefaultAsync();
                if (role == null)
                    return BadRequest("Role not found in DB: " + roleId);

                await _userRoles.InsertOneAsync(new UserRole { UserId = user.UserId, RoleId = roleId });

                if (roleId == 2)
                {
                    await _usage.InsertOneAsync(new Usage
                    {
                        UserId = user.UserId,
                        OverallUsage = 0,
                        TotalLimit = 100,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
            }

            if (!user.IsActive)
                return Unauthorized("Your account has been deactivated. Please contact an administrator.");

            var userRole = await _userRoles.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
            if (userRole == null)
                return Unauthorized("User has no role assigned.");
            int roleIdForJwt = userRole.RoleId;

            string jwtKey = Environment.GetEnvironmentVariable("JWT_KEY") ?? throw new Exception("Missing JWT_KEY");
            int jwtExpireMinutes = 15;
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims = new[]
            {
                new Claim("userId", user.UserId ?? ""),
                new Claim("username", user.Username ?? ""),
                new Claim(ClaimTypes.Role, roleIdForJwt.ToString())
            };
            var jwtToken = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(jwtExpireMinutes),
                signingCredentials: creds
            );
            string jwt = new JwtSecurityTokenHandler().WriteToken(jwtToken);

            string refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            DateTime refreshExpires = DateTime.UtcNow.AddDays(1);
            await _refreshTokens.InsertOneAsync(new RefreshTokenSession
            {
                UserId = user.UserId,
                Token = refreshToken,
                ExpiresAt = refreshExpires,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = refreshExpires,
                Path = "/"
            });

            return Ok(new { Jwt = jwt, email = user.Email });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            // 1. Read refresh token from HttpOnly cookie
            string refreshToken = Request.Cookies["refreshToken"];

            if (!string.IsNullOrEmpty(refreshToken))
            {
                await _refreshTokens.DeleteOneAsync(rt => rt.Token == refreshToken);
            }

            // 3. Always clear cookies (even if token was missing/expired)
            // Use SameSite.Lax now that Vercel proxy makes this same-site request
            Response.Cookies.Delete("refreshToken", new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Path = "/"
            });

            return Ok(new { message = "Logged out" });
        }

        // ----- Two-Factor Authentication (TOTP) -----

        [Authorize(Roles = "1, 2")]
        [HttpGet("2fa/status")]
        public async Task<IActionResult> GetTwoFactorStatus()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId");
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();
            var user = await _users.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            if (user == null)
                return NotFound();
            return Ok(new { twoFactorEnabled = user.TwoFactorEnabled });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPost("2fa/setup")]
        public async Task<IActionResult> TwoFactorSetup()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId");
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();
            var user = await _users.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            if (user == null)
                return NotFound();
            if (user.TwoFactorEnabled)
                return BadRequest("Two-factor authentication is already enabled.");

            var keyBytes = KeyGeneration.GenerateRandomKey(20);
            var secretBase32 = Base32Encoding.ToString(keyBytes);

            var update = Builders<User>.Update
                .Set(u => u.TwoFactorPendingSecret, secretBase32)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);
            await _users.UpdateOneAsync(u => u.UserId == userId, update);

            var appName = "SmartKB";
            var label = Uri.EscapeDataString(appName + ":" + (user.Email ?? ""));
            var issuer = Uri.EscapeDataString(appName);
            var qrCodeUrl = $"otpauth://totp/{label}?secret={secretBase32}&issuer={issuer}&algorithm=SHA1&digits=6&period=30";

            return Ok(new { secretBase32, qrCodeUrl });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPost("2fa/enable")]
        public async Task<IActionResult> TwoFactorEnable([FromBody] EnableTwoFactorDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Code) || dto.Code.Length != 6)
                return BadRequest("Enter the 6-digit code from your authenticator app.");
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId");
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();
            var user = await _users.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            if (user == null)
                return NotFound();
            var pendingSecret = user.TwoFactorPendingSecret;
            if (string.IsNullOrEmpty(pendingSecret))
                return BadRequest("Setup 2FA first: call GET /auth/2fa/setup and scan the QR code.");

            try
            {
                var keyBytes = Base32Encoding.ToBytes(pendingSecret);
                var totp = new Totp(keyBytes);
                var window = new VerificationWindow(1, 1);
                if (!totp.VerifyTotp(dto.Code.Trim(), out _, window))
                    return BadRequest("Invalid code. Please try again.");
            }
            catch
            {
                return BadRequest("Invalid code format.");
            }

            var update = Builders<User>.Update
                .Set(u => u.TwoFactorSecret, pendingSecret)
                .Set(u => u.TwoFactorEnabled, true)
                .Set(u => u.TwoFactorPendingSecret, null)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);
            await _users.UpdateOneAsync(u => u.UserId == userId, update);

            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendTwoFactorEnabledEmailAsync(user.Email ?? "", user.Username ?? user.Email ?? "");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[2FA Enable] Email send failed: {ex.Message}");
                }
            });

            return Ok(new { message = "Two-factor authentication is now enabled." });
        }

        [Authorize(Roles = "1, 2")]
        [HttpPost("2fa/disable")]
        public async Task<IActionResult> TwoFactorDisable([FromBody] DisableTwoFactorDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest("Password is required to disable 2FA.");
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId");
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();
            var user = await _users.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            if (user == null)
                return NotFound();
            var hash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(dto.Password + user.PasswordSalt)));
            if (hash != user.PasswordHash)
                return Unauthorized("Invalid password.");

            var update = Builders<User>.Update
                .Set(u => u.TwoFactorEnabled, false)
                .Set(u => u.TwoFactorSecret, null)
                .Set(u => u.TwoFactorPendingSecret, null)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);
            await _users.UpdateOneAsync(u => u.UserId == userId, update);

            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendTwoFactorDisabledEmailAsync(user.Email ?? "", user.Username ?? user.Email ?? "");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[2FA Disable] Email send failed: {ex.Message}");
                }
            });

            return Ok(new { message = "Two-factor authentication has been disabled." });
        }

        [AllowAnonymous]
        [HttpPost("2fa/verify-login")]
        public async Task<IActionResult> TwoFactorVerifyLogin([FromBody] VerifyTwoFactorLoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.TempToken) || string.IsNullOrWhiteSpace(dto.Code) || dto.Code.Length != 6)
                return BadRequest("Temp token and 6-digit code are required.");
            string jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
                ?? throw new Exception("Missing JWT_KEY in .env");
            var tokenHandler = new JwtSecurityTokenHandler();
            ClaimsPrincipal principal;
            try
            {
                principal = tokenHandler.ValidateToken(dto.TempToken, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                }, out _);
            }
            catch
            {
                return Unauthorized("Invalid or expired code. Please sign in again.");
            }
            var userId = principal.FindFirstValue("userId");
            if (string.IsNullOrEmpty(userId) || principal.FindFirstValue("2fa_pending") != "1")
                return Unauthorized("Invalid token.");
            var user = await _users.Find(u => u.UserId == userId).FirstOrDefaultAsync();
            if (user == null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
                return Unauthorized("Invalid or expired. Please sign in again.");

            try
            {
                var keyBytes = Base32Encoding.ToBytes(user.TwoFactorSecret);
                var totp = new Totp(keyBytes);
                var window = new VerificationWindow(1, 1);
                if (!totp.VerifyTotp(dto.Code.Trim(), out _, window))
                    return Unauthorized("Invalid code. Please try again.");
            }
            catch
            {
                return Unauthorized("Invalid code.");
            }

            var userRole = await _userRoles.Find(ur => ur.UserId == user.UserId).FirstOrDefaultAsync();
            if (userRole == null)
                return Unauthorized("User has no role assigned.");
            int roleId = userRole.RoleId;

            int jwtExpireMinutes = 15;
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims = new[]
            {
                new Claim("userId", user.UserId ?? ""),
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
            var refreshTokenRecord = new RefreshTokenSession
            {
                UserId = user.UserId ?? throw new InvalidOperationException("UserId is missing"),
                Token = refreshToken,
                ExpiresAt = refreshExpires,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _refreshTokens.InsertOneAsync(refreshTokenRecord);
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = refreshExpires,
                Path = "/"
            });

            return Ok(new { Jwt = jwt });
        }

        [Authorize(Roles = "1")]
        [HttpGet("admin/sessions")]
        public async Task<IActionResult> GetAllSessions()
        {
            var allTokens = await _refreshTokens.Find(_ => true).ToListAsync();
            
            var sessionsWithUserInfo = new List<object>();
            foreach (var token in allTokens)
            {
                var user = await _users.Find(u => u.UserId == token.UserId).FirstOrDefaultAsync();
                sessionsWithUserInfo.Add(new
                {
                    id = token.Id,
                    userId = token.UserId,
                    userEmail = user?.Email ?? "Unknown",
                    userName = user?.Username ?? "Unknown",
                    createdAt = token.CreatedAt,
                    updatedAt = token.UpdatedAt,
                    expiresAt = token.ExpiresAt,
                    isExpired = token.ExpiresAt < DateTime.UtcNow
                });
            }

            return Ok(sessionsWithUserInfo.OrderByDescending(s => ((dynamic)s).createdAt));
        }

        [Authorize(Roles = "1")]
        [HttpDelete("admin/sessions/expired")]
        public async Task<IActionResult> DeleteExpiredSessions()
        {
            var deletedCount = await _refreshTokens.DeleteManyAsync(rt => rt.ExpiresAt < DateTime.UtcNow);
            return Ok(new { message = $"Deleted {deletedCount.DeletedCount} expired session(s)" });
        }



        [HttpPost("renew")]
        public async Task<IActionResult> RenewToken()
        {
            string refreshToken = Request.Cookies["refreshToken"];
            if (string.IsNullOrEmpty(refreshToken))
                return Unauthorized("Missing refresh token cookie");

            var refreshSession = await _refreshTokens.Find(rt => rt.Token == refreshToken).FirstOrDefaultAsync();
            if (refreshSession == null)
                return Unauthorized("Invalid refresh token");

            if (refreshSession.ExpiresAt < DateTime.UtcNow)
                return Unauthorized("Refresh token expired");

            var user = await _users.Find(u => u.UserId == refreshSession.UserId).FirstOrDefaultAsync();
            if (user == null)
                return Unauthorized("Invalid refresh token");

            var updateSession = Builders<RefreshTokenSession>.Update
                .Set(rt => rt.UpdatedAt, DateTime.UtcNow);

            await _refreshTokens.UpdateOneAsync(rt => rt.Token == refreshToken, updateSession);

            // Check if user is active
            if (!user.IsActive)
                return Unauthorized("Your account has been deactivated. Please contact an administrator.");

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
                return BadRequest("Email is required");
            }

            // Check if user exists (but don't reveal if they don't for security)
            // Console.WriteLine($"[Forgot Password] Looking up user by email...");
            var user = await _users.Find(u => u.Email.ToLower() == dto.Email.ToLower()).FirstOrDefaultAsync();
            
            if (user == null)
            {

                // Return success even if user doesn't exist to prevent email enumeration
                return Ok(new { message = "If an account exists with that email, a reset code has been sent." });
            }

            // Console.WriteLine($"[Forgot Password] User found - UserId: {user.UserId}, Username: {user.Username}");

            // Check if user is active
            if (!user.IsActive)
            {

                return Ok(new { message = "If an account exists with that email, a reset code has been sent." });
            }

            // Check if UserId is set (it should be populated from MongoDB _id)
            if (string.IsNullOrEmpty(user.UserId))
            {

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

            var user = await _users.Find(u => u.Email.ToLower() == dto.Email.ToLower()).FirstOrDefaultAsync();
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

            var user = await _users.Find(u => u.Email.ToLower() == dto.Email.ToLower()).FirstOrDefaultAsync();
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
            await _passwordResetTokens.UpdateOneAsync(t => t.PasswordResetTokenId == token.PasswordResetTokenId, updateToken);

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
