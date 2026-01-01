using System;
using Microsoft.Extensions.Configuration;

namespace SmartKB.Services
{
    public static class MongoSettingsProvider
    {
        public static (string ConnectionString, string DatabaseName) Get(IConfiguration config)
        {
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING")
                ?? config["MongoDbSettings:ConnectionString"]
                ?? throw new Exception("MongoDB connection string not configured");

            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME")
                ?? config["MongoDbSettings:DatabaseName"]
                ?? throw new Exception("MongoDB database name not configured");

            return (connectionString, databaseName);
        }
    }
}
