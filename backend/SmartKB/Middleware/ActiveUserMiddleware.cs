using MongoDB.Driver;
using SmartKB.Models;

namespace SmartKB.Middleware
{
    public class ActiveUserMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IConfiguration _configuration;

        public ActiveUserMiddleware(RequestDelegate next, IConfiguration configuration)
        {
            _next = next;
            _configuration = configuration;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Only check for authenticated requests
            if (context.User?.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = context.User.Claims.FirstOrDefault(c => c.Type == "userId");
                if (userIdClaim != null)
                {
                    var userId = userIdClaim.Value;
                    var client = new MongoClient(_configuration["MongoDbSettings:ConnectionString"]);
                    var database = client.GetDatabase(_configuration["MongoDbSettings:DatabaseName"]);
                    var userCollection = database.GetCollection<User>("users");

                    var user = await userCollection.Find(u => u.UserId == userId).FirstOrDefaultAsync();
                    
                    if (user != null && !user.IsActive)
                    {
                        context.Response.StatusCode = 403;
                        await context.Response.WriteAsJsonAsync(new { message = "Your account has been deactivated. Please contact an administrator." });
                        return;
                    }
                }
            }

            await _next(context);
        }
    }
}

