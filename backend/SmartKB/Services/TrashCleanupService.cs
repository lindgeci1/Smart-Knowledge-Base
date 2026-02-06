using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using SmartKB.Models;

namespace SmartKB.Services
{
    /// <summary>
    /// Periodically deletes items that have been in Trash beyond retention period.
    /// </summary>
    public class TrashCleanupService : BackgroundService
    {
        private readonly IMongoCollection<Document> _documents;
        private readonly IMongoCollection<Text> _texts;
        private readonly int _retentionDays;

        public TrashCleanupService(IConfiguration configuration)
        {
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ??
                                   configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ??
                               configuration["MongoDbSettings:DatabaseName"];

            var retentionRaw = Environment.GetEnvironmentVariable("TRASH_RETENTION_DAYS") ??
                               configuration["Trash:RetentionDays"];

            _retentionDays = int.TryParse(retentionRaw, out var days) && days > 0 ? days : 30;

            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _documents = database.GetCollection<Document>("documents");
            _texts = database.GetCollection<Text>("texts");
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Small delay to avoid competing with startup work
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
            catch
            {
                return;
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                await CleanupOnce(stoppingToken);

                try
                {
                    await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
                }
                catch
                {
                    // shutting down
                    return;
                }
            }
        }

        private async Task CleanupOnce(CancellationToken cancellationToken)
        {
            var cutoff = DateTime.UtcNow.AddDays(-_retentionDays);

            var docFilter = Builders<Document>.Filter.Eq(d => d.IsDeleted, true) &
                            Builders<Document>.Filter.Lt(d => d.DeletedAt, cutoff);

            var textFilter = Builders<Text>.Filter.Eq(t => t.IsDeleted, true) &
                             Builders<Text>.Filter.Lt(t => t.DeletedAt, cutoff);

            try
            {
                await _documents.DeleteManyAsync(docFilter, cancellationToken);
                await _texts.DeleteManyAsync(textFilter, cancellationToken);
            }
            catch (Exception ex)
            {
                // Don't crash the service; log and retry next run
                Console.WriteLine($"TrashCleanupService failed: {ex.Message}");
            }
        }
    }
}

