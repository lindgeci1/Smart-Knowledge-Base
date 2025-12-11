using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using MongoDB.Bson;

namespace SmartKB.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class DatabaseTestController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public DatabaseTestController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet]
        public IActionResult Get()
        {
            try
            {
                var connectionString = _configuration["MongoDbSettings:ConnectionString"];
                var databaseName = _configuration["MongoDbSettings:DatabaseName"];

                var client = new MongoClient(connectionString);
                var database = client.GetDatabase(databaseName);

                
                var collections = database.ListCollectionNames().ToList();

                
                var docCollection = database.GetCollection<BsonDocument>("documents");
                var sampleDoc = docCollection.Find(Builders<BsonDocument>.Filter.Empty).FirstOrDefault();

                return Ok(new
                {
                    message = "MongoDB connection successful!",
                    collections = collections,
                    sampleDocument = sampleDoc?.ToJson()
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = "MongoDB connection failed!",
                    error = ex.Message
                });
            }
        }
    }
}
