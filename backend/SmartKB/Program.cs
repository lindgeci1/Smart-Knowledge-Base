using System.Diagnostics;
using CloudinaryDotNet;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using SmartKB.Services;

DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient();

// Register Services
builder.Services.AddSingleton<EmailService>();
builder.Services.AddSingleton<EmbeddingService>();
builder.Services.AddSingleton<PodcastService>();

var cloudinaryUrlRaw = Environment.GetEnvironmentVariable("CLOUDINARY_URL")?.Trim().Trim('"');
if (string.IsNullOrWhiteSpace(cloudinaryUrlRaw))
{
    throw new Exception("Missing CLOUDINARY_URL");
}

Account account;
if (cloudinaryUrlRaw.StartsWith("cloudinary://", StringComparison.OrdinalIgnoreCase))
{
    // Format: cloudinary://api_key:api_secret@cloud_name
    var uri = new Uri(cloudinaryUrlRaw);
    var cloudName = uri.Host;
    var userInfo = uri.UserInfo;
    var sep = userInfo.IndexOf(':');
    if (sep <= 0 || sep >= userInfo.Length - 1)
        throw new Exception("Invalid CLOUDINARY_URL format. Expected cloudinary://api_key:api_secret@cloud_name");

    var apiKey = userInfo.Substring(0, sep);
    var apiSecret = userInfo.Substring(sep + 1);
    account = new Account(cloudName, apiKey, apiSecret);
}
else
{
    // Fallback: allow passing cloud name only (not recommended)
    account = new Account(cloudinaryUrlRaw);
}

var cloudinary = new Cloudinary(account);
cloudinary.Api.Secure = true;
builder.Services.AddSingleton(cloudinary);
builder.Services.AddHostedService<TrashCleanupService>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var frontendUrls = (Environment.GetEnvironmentVariable("FRONTEND_URL")
                            ?? "http://localhost:5173")
                            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        policy.WithOrigins(frontendUrls)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Important: allows cookies (refresh token)
    });
});


string jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? throw new Exception("Missing JWT_KEY");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "SmartKB API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Example: Bearer {your token}"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[]{}
        }
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseRouting();

// Use CORS before Authentication/Authorization
app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

// Add middleware to check if user is active
app.UseMiddleware<SmartKB.Middleware.ActiveUserMiddleware>();

app.MapControllers();

app.Run();
