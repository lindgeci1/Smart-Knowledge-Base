using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.Models;

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

            var client = new MongoClient(configuration["MongoDbSettings:ConnectionString"]);
            var database = client.GetDatabase(configuration["MongoDbSettings:DatabaseName"]);

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
                .Find(p => p.Id == id && p.IsActive)
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
    }
}

