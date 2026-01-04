using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.Models;
using SmartKB.Services;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PackageController : ControllerBase
    {
        private readonly IMongoCollection<Package> _packageCollection;
        private readonly IConfiguration _configuration;

        public PackageController(IConfiguration configuration)
        {
            _configuration = configuration;

            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _packageCollection = database.GetCollection<Package>("packages");
        }

        [Authorize(Roles = "1, 2")]
        [HttpGet]
        public async Task<IActionResult> GetPackages()
        {
            var packages = await _packageCollection
                .Find(p => p.IsActive)
                .SortBy(p => p.Price)
                .ToListAsync();

            return Ok(packages);
        }
        [Authorize(Roles = "1, 2")]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetPackageById(string id)
        {
            var package = await _packageCollection
                .Find(p => p.PackageId == id && p.IsActive)
                .FirstOrDefaultAsync();

            if (package == null)
                return NotFound("Package not found");

            return Ok(package);
        }

        [Authorize(Roles = "1")] // Admin only
        [HttpPost("seed")]
        public async Task<IActionResult> SeedPackages()
        {
            // Check if packages already exist
            var existingCount = await _packageCollection.CountDocumentsAsync(_ => true);
            if (existingCount > 0)
            {
                return BadRequest("Packages already exist in database. Delete them first if you want to reseed.");
            }

            var packages = new List<Package>
            {
                new Package
                {
                    Name = "Starter Boost",
                    Description = "Perfect for small projects",
                    Price = 9,
                    PriceType = "one-time",
                    SummaryLimit = 50,
                    Features = new List<string>
                    {
                        "+50 Summaries",
                        "Basic Support",
                        "Standard Processing"
                    },
                    IsPopular = false,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Package
                {
                    Name = "Pro Power",
                    Description = "Best value for professionals",
                    Price = 29,
                    PriceType = "one-time",
                    SummaryLimit = 200,
                    Features = new List<string>
                    {
                        "+200 Summaries",
                        "Priority Support",
                        "Faster Processing",
                        "Advanced Analytics"
                    },
                    IsPopular = true,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Package
                {
                    Name = "Enterprise Scale",
                    Description = "For heavy duty usage",
                    Price = 99,
                    PriceType = "one-time",
                    SummaryLimit = 1000,
                    Features = new List<string>
                    {
                        "+1000 Summaries",
                        "24/7 Support",
                        "Instant Processing",
                        "API Access"
                    },
                    IsPopular = false,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            };

            await _packageCollection.InsertManyAsync(packages);

            return Ok(new { message = "Packages seeded successfully", count = packages.Count });
        }

        [Authorize(Roles = "1")] // Admin only
        [HttpDelete("seed")]
        public async Task<IActionResult> DeleteAllPackages()
        {
            var result = await _packageCollection.DeleteManyAsync(_ => true);
            return Ok(new { message = "All packages deleted", deletedCount = result.DeletedCount });
        }

        [Authorize(Roles = "1")] // Admin only
        [HttpGet("admin")]
        public async Task<IActionResult> GetAllPackages()
        {
            var packages = await _packageCollection
                .Find(_ => true)
                .SortBy(p => p.Price)
                .ToListAsync();

            return Ok(packages);
        }

        [Authorize(Roles = "1")] // Admin only
        [HttpDelete("admin/{id}")]
        public async Task<IActionResult> DeletePackage(string id)
        {
            var package = await _packageCollection
                .Find(p => p.PackageId == id)
                .FirstOrDefaultAsync();

            if (package == null)
                return NotFound("Package not found");

            // Set package as inactive instead of deleting (similar to user deactivation)
            var update = Builders<Package>.Update
                .Set(p => p.IsActive, false)
                .Set(p => p.UpdatedAt, DateTime.UtcNow);

            await _packageCollection.UpdateOneAsync(p => p.PackageId == id, update);
            return Ok(new { message = "Package deactivated successfully" });
        }

        [Authorize(Roles = "1")] // Admin only
        [HttpPost("admin/{id}/reactivate")]
        public async Task<IActionResult> ReactivatePackage(string id)
        {
            var package = await _packageCollection
                .Find(p => p.PackageId == id)
                .FirstOrDefaultAsync();

            if (package == null)
                return NotFound("Package not found");

            // Set package as active
            var update = Builders<Package>.Update
                .Set(p => p.IsActive, true)
                .Set(p => p.UpdatedAt, DateTime.UtcNow);

            await _packageCollection.UpdateOneAsync(p => p.PackageId == id, update);
            return Ok(new { message = "Package reactivated successfully" });
        }
    }
}

