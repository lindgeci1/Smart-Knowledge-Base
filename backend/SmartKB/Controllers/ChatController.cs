using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartKB.Models;
using System.Text;
using System.Text.Json;
using SmartKB.Services;

namespace SmartKB.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly IMongoCollection<Document> _documentCollection;
        private readonly IMongoCollection<Text> _textCollection;
        private readonly IMongoCollection<Chat> _chatCollection;
        private readonly IMongoCollection<ChatMessage> _chatMessageCollection;
        private readonly AiService _aiService;
        private readonly IConfiguration _configuration;

        public ChatController(IConfiguration configuration)
        {
            _configuration = configuration;
            
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? configuration["MongoDbSettings:ConnectionString"];
            var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME") ?? configuration["MongoDbSettings:DatabaseName"];
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);

            _documentCollection = database.GetCollection<Document>("documents");
            _textCollection = database.GetCollection<Text>("texts");
            _chatCollection = database.GetCollection<Chat>("chats");
            _chatMessageCollection = database.GetCollection<ChatMessage>("chat_messages");
            _aiService = new AiService(configuration);
        }

        [HttpGet("GetAllChats")]
        public async Task<IActionResult> GetAllChats()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null) return Unauthorized();
            var userId = userIdClaim.Value;

            var sessions = await _chatCollection.Find(s => s.UserId == userId)
                .SortByDescending(s => s.UpdatedAt)
                .ToListAsync();

            return Ok(sessions);
        }

        [HttpPost("CreateChat")]
        public async Task<IActionResult> CreateChat([FromBody] CreateSessionRequest request)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null) return Unauthorized();
            var userId = userIdClaim.Value;

            var session = new Chat
            {
                UserId = userId,
                Title = !string.IsNullOrEmpty(request.Title) ? request.Title : "New Chat",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _chatCollection.InsertOneAsync(session);
            return Ok(session);
        }

        [HttpGet("GetAllMessages/{chatId}")]
        public async Task<IActionResult> GetAllMessages(string chatId)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null) return Unauthorized();
            var userId = userIdClaim.Value;

            // Verify ownership
            var session = await _chatCollection.Find(s => s.ChatId == chatId && s.UserId == userId).FirstOrDefaultAsync();
            if (session == null) return NotFound("Session not found");

            var messages = await _chatMessageCollection.Find(m => m.ChatId == chatId)
                .SortBy(m => m.CreatedAt)
                .ToListAsync();

            return Ok(messages);
        }

        [HttpPost("CreateMessage/{chatId}")]
        public async Task<IActionResult> CreateMessage(string chatId, [FromBody] SendMessageRequest request)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null) return Unauthorized();
            var userId = userIdClaim.Value;

            if (!MongoDB.Bson.ObjectId.TryParse(chatId, out _))
            {
                return BadRequest("Invalid Chat ID format");
            }

            var session = await _chatCollection.Find(s => s.ChatId == chatId && s.UserId == userId).FirstOrDefaultAsync();
            
            if (session == null) 
            {
                return NotFound("Session not found");
            }

            // 1. Save User Message
            var userMessage = new ChatMessage
            {
                ChatId = chatId,
                Role = "user",
                Content = request.Message,
                CreatedAt = DateTime.UtcNow
            };
            await _chatMessageCollection.InsertOneAsync(userMessage);

            // 2. Prepare Context (if document selected)
            string contextContent = "";
            
            // If request doesn't have documentId but session does, use session's (Lock behavior)
            if (string.IsNullOrEmpty(request.DocumentId) && !string.IsNullOrEmpty(session.DocumentId))
            {
                request.DocumentId = session.DocumentId;
            }

            if (!string.IsNullOrEmpty(request.DocumentId))
            {
                // Try finding in Documents (files)
                var document = await _documentCollection.Find(d => d.DocumentId == request.DocumentId && d.UserId == userId).FirstOrDefaultAsync();
                if (document != null)
                {
                    // Use the summary as the report context
                    contextContent = document.Summary;
                }
                else
                {
                    // Try finding in Texts
                    var textDoc = await _textCollection.Find(t => t.TextId == request.DocumentId && t.UserId == userId).FirstOrDefaultAsync();
                    if (textDoc != null)
                    {
                        contextContent = textDoc.Summary;
                    }
                }
            }

            var prompt = string.IsNullOrEmpty(contextContent)
                ? $"You are Summy, a helpful AI assistant. Answer the user's question concisely and accurately. Do not use markdown formatting. User Question: {request.Message}"
                : $"You are Summy, a helpful AI assistant. Your task is to answer the user's question based ONLY on the provided summary report below.\n- Provide a direct and accurate answer.\n- Do not include information not present in the report.\n- If the answer cannot be found in the report, explicitly state: 'I cannot find the answer to that question in the selected document.'\n- Do not use markdown formatting.\n- Split the answer into clear sections if it is long.\n\nSummary Report:\n{contextContent}\n\nUser Question: {request.Message}";

            try 
            {
                var responseText = await _aiService.ChatWithAi(prompt);

                // 3. Save AI Message
                var aiMessage = new ChatMessage
                {
                    ChatId = chatId,
                    Role = "assistant",
                    Content = responseText,
                    CreatedAt = DateTime.UtcNow
                };
                await _chatMessageCollection.InsertOneAsync(aiMessage);

                // Update session timestamp and Title if it's "New Chat"
                var updateBuilder = Builders<Chat>.Update.Set(s => s.UpdatedAt, DateTime.UtcNow);
                
                if (session.Title == "New Chat")
                {
                    // Use user's question as title, truncated to 30 chars
                    var newTitle = request.Message.Length > 30 
                        ? request.Message.Substring(0, 27) + "..." 
                        : request.Message;
                    updateBuilder = updateBuilder.Set(s => s.Title, newTitle);
                }
                
                // Lock document ID if provided and not set
                if (string.IsNullOrEmpty(session.DocumentId) && !string.IsNullOrEmpty(request.DocumentId))
                {
                    updateBuilder = updateBuilder.Set(s => s.DocumentId, request.DocumentId);
                }

                await _chatCollection.UpdateOneAsync(s => s.ChatId == chatId, updateBuilder);

                return Ok(aiMessage);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error communicating with AI: {ex.Message}");
            }
        }

        [HttpDelete("DeleteChat/{chatId}")]
        public async Task<IActionResult> DeleteChat(string chatId)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "userId");
            if (userIdClaim == null) return Unauthorized();
            var userId = userIdClaim.Value;

            var session = await _chatCollection.Find(s => s.ChatId == chatId && s.UserId == userId).FirstOrDefaultAsync();
            if (session == null) return NotFound("Chat not found");

            // Delete chat session
            await _chatCollection.DeleteOneAsync(s => s.ChatId == chatId);
            // Delete all messages in that chat
            await _chatMessageCollection.DeleteManyAsync(m => m.ChatId == chatId);

            return Ok(new { message = "Chat deleted successfully" });
        }
    }

    public class CreateSessionRequest
    {
        public string Title { get; set; }
    }

    public class SendMessageRequest
    {
        public string Message { get; set; }
        public string DocumentId { get; set; } // Optional context
    }
}