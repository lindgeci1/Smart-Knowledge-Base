using System.Net.Http.Json;
using System.Runtime.ExceptionServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.TextToSpeech.V1;
using Grpc.Auth;
using Grpc.Core;
using Microsoft.AspNetCore.Hosting;
using NAudio.Wave;
using NLayer.NAudioSupport;
using SmartKB.Models;

namespace SmartKB.Services
{
    public class PodcastService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IWebHostEnvironment _env;
        private readonly Cloudinary _cloudinary;

        private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = true
        };

        private TextToSpeechClient? _ttsClient;

        public PodcastService(
            IHttpClientFactory httpClientFactory,
            IWebHostEnvironment env,
            Cloudinary cloudinary
        )
        {
            _httpClientFactory = httpClientFactory;
            _env = env;
            _cloudinary = cloudinary;
        }

        private TextToSpeechClient GetTtsClient()
        {
            if (_ttsClient != null) return _ttsClient;

            GoogleCredential? credential = null;

            // 1) Check ENV first (production)
            var jsonString = Environment.GetEnvironmentVariable("GOOGLE_CREDENTIALS_JSON");
            if (!string.IsNullOrWhiteSpace(jsonString))
            {
                // Render can sometimes wrap env values in quotes
                jsonString = jsonString.Trim().Trim('"');
                credential = GoogleCredential.FromJson(jsonString);
            }
            else
            {
                // 2) Check file second (local fallback)
                const string fileName = "google-credentials.json";
                if (File.Exists(fileName))
                {
                    credential = GoogleCredential.FromFile(fileName);
                }
            }

            // 4) Error handling
            if (credential == null)
            {
                throw new Exception("Google Credentials not found in ENV or File.");
            }

            // Ensure proper scopes for Google Cloud APIs (required for service account / user creds)
            if (credential.IsCreateScopedRequired)
            {
                credential = credential.CreateScoped(TextToSpeechClient.DefaultScopes);
            }

            // 3) Pass to client
            var builder = new TextToSpeechClientBuilder
            {
                ChannelCredentials = credential.ToChannelCredentials()
            };

            _ttsClient = builder.Build();
            return _ttsClient;
        }

        private sealed record ScriptLine(string Speaker, string Text);

        private sealed class ScriptLineDto
        {
            public string? Speaker { get; set; }
            public string? Text { get; set; }
        }

        public sealed class PodcastGenerationResult
        {
            public string AudioUrl { get; set; } = string.Empty;
            public double DurationSeconds { get; set; }
            public List<PodcastSegment> Segments { get; set; } = new();
        }

        public async Task<PodcastGenerationResult> GeneratePodcastAsync(
            string documentId,
            string sourceText,
            CancellationToken ct = default
        )
        {
            if (string.IsNullOrWhiteSpace(documentId))
                throw new ArgumentException("documentId is required.", nameof(documentId));

            // GENERATE
            var (audioBytes, segments, durationSeconds) = await GeneratePodcastInternalAsync(sourceText, ct);

            // UPLOAD TO CLOUDINARY (memory stream)
            var cloudinaryUrl = Environment.GetEnvironmentVariable("CLOUDINARY_URL");
            if (string.IsNullOrWhiteSpace(cloudinaryUrl))
                throw new Exception("Missing CLOUDINARY_URL");

            using var stream = new MemoryStream(audioBytes);
            stream.Position = 0;

            var uploadParams = new VideoUploadParams
            {
                File = new FileDescription($"{documentId}.mp3", stream),
                Folder = "podcasts",
                PublicId = documentId,
                Overwrite = true
            };

            var uploadResult = await _cloudinary.UploadAsync(uploadParams);
            var secureUrl = uploadResult?.SecureUrl?.ToString();
            if (string.IsNullOrWhiteSpace(secureUrl))
            {
                var msg = uploadResult?.Error?.Message;
                throw new Exception($"Cloudinary upload failed{(string.IsNullOrWhiteSpace(msg) ? "" : $": {msg}")}");
            }

            // RETURN (controller handles caching/persistence)
            return new PodcastGenerationResult
            {
                AudioUrl = secureUrl,
                DurationSeconds = durationSeconds,
                Segments = segments
            };
        }

        public async Task<byte[]> GeneratePodcastMp3Async(string sourceText, CancellationToken ct = default)
        {
            var (audioBytes, _, _) = await GeneratePodcastInternalAsync(sourceText, ct);
            return audioBytes;
        }

        private async Task<(byte[] AudioBytes, List<PodcastSegment> Segments, double DurationSeconds)> GeneratePodcastInternalAsync(
            string sourceText,
            CancellationToken ct = default
        )
        {
            if (string.IsNullOrWhiteSpace(sourceText))
                throw new ArgumentException("Source text is empty.", nameof(sourceText));

            // Keep prompt sizes sane (Gemini + TTS)
            var trimmed = sourceText.Trim();
            const int maxInputChars = 25000;
            if (trimmed.Length > maxInputChars)
                trimmed = trimmed.Substring(0, maxInputChars);

            var script = await GenerateConversationScriptAsync(trimmed, ct);
            if (script.Count == 0)
                throw new Exception("Script generation returned no lines.");

            // Stitch while generating, so we can calculate timestamps from actual MP3 frames.
            using var output = new MemoryStream(capacity: 1024 * 1024);
            var segmentsMeta = new List<PodcastSegment>(capacity: Math.Max(16, script.Count));
            var totalSeconds = 0.0;

            foreach (var line in script)
            {
                ct.ThrowIfCancellationRequested();

                var normalized = NormalizeSpeaker(line.Speaker); // Host/Guest
                var voiceName = normalized == "Guest" ? "en-US-Journey-F" : "en-US-Journey-D";

                var start = totalSeconds;
                var lineSeconds = 0.0;

                // Google TTS hard limit (~5000 bytes) for input.text per request.
                foreach (var chunk in SplitForTtsByUtf8Bytes(line.Text, maxBytes: 4800))
                {
                    ct.ThrowIfCancellationRequested();

                    var mp3 = await SynthesizeMp3Async(chunk, voiceName, ct);
                    var dur = AppendMp3ToOutputAndGetDurationSeconds(mp3, output);
                    totalSeconds += dur;
                    lineSeconds += dur;
                }

                var displaySpeaker = normalized == "Guest" ? "Sarah" : "Alex";
                segmentsMeta.Add(new PodcastSegment
                {
                    Speaker = displaySpeaker,
                    StartTime = start,
                    EndTime = start + lineSeconds
                });
            }

            return (output.ToArray(), segmentsMeta, totalSeconds);
        }

        // -----------------------------
        // Step A: Gemini -> JSON script
        // -----------------------------
        private async Task<List<ScriptLine>> GenerateConversationScriptAsync(string text, CancellationToken ct)
        {
            var apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new Exception("Missing GEMINI_API_KEY");

            // REQUIRED by user: use EXACT model name in URL
            var url =
                $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={Uri.EscapeDataString(apiKey)}";

            var prompt =
                "You are two expert analysts, 'Alex' (Host, Male) and 'Sarah' (Expert, Female), reviewing a document for a Knowledge Base.\n" +
                "Task: Discuss the content of the provided text. Summarize the key points, explain complex terms, and mention specific details found in the text.\n" +
                "Constraints:\n" +
                "- Do NOT act like recruiters.\n" +
                "- Do NOT have generic small talk (e.g., 'How was your weekend?').\n" +
                "- Start immediately with the document's topic.\n" +
                "- If the text is technical, explain it simply.\n" +
                "- Reference specific headers or data points from the text.\n\n" +
                "RULES: Output strictly valid JSON array. Do not use markdown blocks. Do not add introductory text.\n" +
                "Keep the conversation concise. Max 500 words total.\n" +
                "The JSON structure must be:\n" +
                "[{ \"speaker\": \"Host\", \"text\": \"...\" }, { \"speaker\": \"Guest\", \"text\": \"...\" }]\n" +
                "speaker must be exactly \"Host\" or \"Guest\".\n" +
                "Speaker mapping: Alex = Host, Sarah = Guest.\n\n" +
                "TEXT:\n" + text;

            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                generationConfig = new
                {
                    // Still helpful if supported; prompt enforces strict JSON.
                    responseMimeType = "application/json",
                    temperature = 0.3,
                    maxOutputTokens = 8192
                }
            };

            var http = _httpClientFactory.CreateClient();
            using var resp = await http.PostAsJsonAsync(url, payload, cancellationToken: ct);
            var raw = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
                throw new Exception($"Gemini script failed: {(int)resp.StatusCode} {resp.ReasonPhrase} - {raw}");

            var modelText = ExtractModelTextFromGemini(raw);
            var cleaned = CleanGeminiJsonString(modelText);

            // Parse JSON array after cleaning; if it fails, log the raw response and fall back.
            try
            {
                var jsonArrayText = EnsureJsonArrayString(cleaned);
                var parsed = JsonSerializer.Deserialize<List<ScriptLineDto>>(jsonArrayText, _jsonOptions) ?? new List<ScriptLineDto>();

                var lines = parsed
                    .Where(x => x != null && !string.IsNullOrWhiteSpace(x.Text))
                    .Select(x => new ScriptLine(NormalizeSpeaker(x!.Speaker), x!.Text!.Trim()))
                    .Where(x => !string.IsNullOrWhiteSpace(x.Text))
                    .ToList();

                return lines;
            }
            catch (Exception ex)
            {
                Console.WriteLine("[PodcastService] ❌ JSON parsing failed. Dumping raw Gemini response:");
                Console.WriteLine(raw);
                Console.WriteLine("[PodcastService] --- Model text (before cleaning) ---");
                Console.WriteLine(modelText);
                Console.WriteLine("[PodcastService] --- Cleaned text ---");
                Console.WriteLine(cleaned);
                Console.WriteLine($"[PodcastService] Parsing error: {ex.Message}");

                // Truncated JSON repair: if deserialize failed, assume the array was cut off mid-stream.
                // Try to trim to the last fully closed object '}' and close the array with ']'.
                try
                {
                    var jsonArrayText = EnsureJsonArrayString(cleaned);
                    if (TryRepairTruncatedJsonArray(jsonArrayText, out var repaired))
                    {
                        var repairedParsed = JsonSerializer.Deserialize<List<ScriptLineDto>>(repaired, _jsonOptions);
                        if (repairedParsed != null)
                        {
                            return repairedParsed
                                .Where(x => x != null && !string.IsNullOrWhiteSpace(x.Text))
                                .Select(x => new ScriptLine(NormalizeSpeaker(x!.Speaker), x!.Text!.Trim()))
                                .Where(x => !string.IsNullOrWhiteSpace(x.Text))
                                .ToList();
                        }
                    }
                }
                catch
                {
                    // ignore and rethrow original below
                }

                // If repair fails, throw original exception (as requested).
                ExceptionDispatchInfo.Capture(ex).Throw();
                throw; // unreachable
            }
        }

        private static bool TryRepairTruncatedJsonArray(string jsonArrayText, out string repaired)
        {
            repaired = string.Empty;
            if (string.IsNullOrWhiteSpace(jsonArrayText))
                return false;

            var s = jsonArrayText.Trim();
            if (!s.StartsWith("["))
                return false;

            // Find the last '}' that is NOT inside a string literal.
            var inString = false;
            var escaped = false;
            var lastObjectClose = -1;
            for (var i = 0; i < s.Length; i++)
            {
                var c = s[i];
                if (escaped)
                {
                    escaped = false;
                    continue;
                }

                if (c == '\\' && inString)
                {
                    escaped = true;
                    continue;
                }

                if (c == '\"')
                {
                    inString = !inString;
                    continue;
                }

                if (!inString && c == '}')
                {
                    lastObjectClose = i;
                }
            }

            if (lastObjectClose < 0)
                return false;

            var cut = s.Substring(0, lastObjectClose + 1).TrimEnd();
            // Remove trailing comma if present (e.g. ...},)
            cut = Regex.Replace(cut, @",\s*$", "");

            repaired = cut + "]";
            return true;
        }

        private static string ExtractModelTextFromGemini(string geminiRaw)
        {
            try
            {
                using var doc = JsonDocument.Parse(geminiRaw);
                if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
                    candidates.ValueKind == JsonValueKind.Array &&
                    candidates.GetArrayLength() > 0)
                {
                    var cand0 = candidates[0];
                    if (cand0.TryGetProperty("content", out var content) &&
                        content.TryGetProperty("parts", out var parts) &&
                        parts.ValueKind == JsonValueKind.Array)
                    {
                        var sb = new StringBuilder();
                        foreach (var part in parts.EnumerateArray())
                        {
                            if (part.TryGetProperty("text", out var textEl) && textEl.ValueKind == JsonValueKind.String)
                            {
                                var t = textEl.GetString();
                                if (!string.IsNullOrWhiteSpace(t))
                                    sb.Append(t);
                            }
                        }

                        var text = sb.ToString();
                        if (!string.IsNullOrWhiteSpace(text))
                            return text;
                    }
                }
            }
            catch
            {
                // ignore
            }

            // Fallback: return the raw JSON if we couldn't extract
            return geminiRaw;
        }

        // REQUIRED: must use Regex to strip markdown formatting/code fences.
        private static string CleanGeminiJsonString(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            var s = input.Trim();

            // Remove ```json / ``` and any ```lang markers
            s = Regex.Replace(s, @"```(?:json)?", "", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"```[a-zA-Z]*", "", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"```", "", RegexOptions.IgnoreCase);

            // Remove common markdown bold/backticks around the whole payload
            s = s.Replace("`", "");

            return s.Trim();
        }

        private static string EnsureJsonArrayString(string cleaned)
        {
            if (string.IsNullOrWhiteSpace(cleaned))
                throw new Exception("Empty response after cleaning.");

            var s = cleaned.Trim();

            // If it's a JSON array already, great.
            if (s.StartsWith("[") && s.EndsWith("]"))
                return s;

            // Otherwise, extract the first array-looking substring.
            var first = s.IndexOf('[');
            var last = s.LastIndexOf(']');
            if (first >= 0 && last > first)
            {
                return s.Substring(first, (last - first) + 1);
            }

            throw new Exception("Cleaned response does not contain a JSON array.");
        }

        private static string NormalizeSpeaker(string? speaker)
        {
            if (string.IsNullOrWhiteSpace(speaker))
                return "Host";

            var s = speaker.Trim();
            if (s.Equals("Guest", StringComparison.OrdinalIgnoreCase)) return "Guest";
            return "Host";
        }

        private static List<ScriptLine> ConvertPlainScriptToLines(string rawScript)
        {
            var result = new List<ScriptLine>();
            if (string.IsNullOrWhiteSpace(rawScript))
                return result;

            // Try to parse "Host: ..." / "Guest: ..." style.
            var lines = rawScript
                .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .Where(x => x.Length > 0)
                .ToList();

            foreach (var line in lines)
            {
                if (line.StartsWith("Host:", StringComparison.OrdinalIgnoreCase))
                {
                    result.Add(new ScriptLine("Host", line.Substring(5).Trim()));
                }
                else if (line.StartsWith("Guest:", StringComparison.OrdinalIgnoreCase))
                {
                    result.Add(new ScriptLine("Guest", line.Substring(6).Trim()));
                }
                else
                {
                    // Default to Host if no label
                    result.Add(new ScriptLine("Host", line));
                }
            }

            // If it was one giant chunk, keep it as one Host line
            if (result.Count == 0)
            {
                result.Add(new ScriptLine("Host", rawScript.Trim()));
            }

            return result;
        }

        // -----------------------------
        // Step B: Google TTS -> MP3 bytes
        // -----------------------------
        private static bool IsTransientTtsError(StatusCode code) =>
            code is StatusCode.Internal or StatusCode.Unavailable or StatusCode.DeadlineExceeded or StatusCode.ResourceExhausted;

        private async Task<byte[]> SynthesizeMp3Async(string text, string voiceName, CancellationToken ct)
        {
            var client = GetTtsClient();

            var input = new SynthesisInput { Text = text };
            var voice = new VoiceSelectionParams { LanguageCode = "en-US", Name = voiceName };
            var audioConfig = new AudioConfig { AudioEncoding = AudioEncoding.Mp3 };

            // Google TTS can sometimes return transient gRPC "Internal" / "Unavailable" errors.
            // Retry a few times with exponential backoff.
            const int maxAttempts = 4;
            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    var response = await client.SynthesizeSpeechAsync(input, voice, audioConfig, cancellationToken: ct);
                    return response.AudioContent.ToByteArray();
                }
                catch (RpcException ex) when (IsTransientTtsError(ex.StatusCode) && attempt < maxAttempts)
                {
                    var bytes = Encoding.UTF8.GetByteCount(text ?? string.Empty);
                    Console.WriteLine(
                        $"[PodcastService] ⚠️ Google TTS transient error ({ex.StatusCode}) attempt {attempt}/{maxAttempts}. voice={voiceName} bytes={bytes}. Retrying..."
                    );

                    var baseMs = 350 * Math.Pow(2, attempt - 1); // 350, 700, 1400...
                    var jitter = Random.Shared.Next(0, 250);
                    var delayMs = (int)Math.Min(4000, baseMs + jitter);
                    await Task.Delay(delayMs, ct);
                }
            }

            // If we got here, last attempt threw (or non-transient). Let it surface for debugging.
            var finalResponse = await client.SynthesizeSpeechAsync(input, voice, audioConfig, cancellationToken: ct);
            return finalResponse.AudioContent.ToByteArray();
        }

        private static IEnumerable<string> SplitForTtsByUtf8Bytes(string text, int maxBytes)
        {
            if (string.IsNullOrWhiteSpace(text))
                yield break;

            if (maxBytes < 500) maxBytes = 500;
            var normalized = text.Trim();

            if (Encoding.UTF8.GetByteCount(normalized) <= maxBytes)
            {
                yield return normalized;
                yield break;
            }

            // Prefer splitting on sentence boundaries.
            var sentenceParts = new List<string>();
            var start = 0;
            for (var i = 0; i < normalized.Length; i++)
            {
                var c = normalized[i];
                if (c == '.' || c == '!' || c == '?' || c == '\n')
                {
                    var seg = normalized.Substring(start, (i - start) + 1).Trim();
                    if (!string.IsNullOrWhiteSpace(seg))
                        sentenceParts.Add(seg);
                    start = i + 1;
                }
            }
            if (start < normalized.Length)
            {
                var tail = normalized.Substring(start).Trim();
                if (!string.IsNullOrWhiteSpace(tail))
                    sentenceParts.Add(tail);
            }
            if (sentenceParts.Count == 0)
                sentenceParts.Add(normalized);

            var current = new StringBuilder();
            foreach (var part in sentenceParts)
            {
                var candidate = current.Length == 0 ? part : $"{current} {part}";
                if (Encoding.UTF8.GetByteCount(candidate) <= maxBytes)
                {
                    current.Clear();
                    current.Append(candidate);
                    continue;
                }

                if (current.Length > 0)
                {
                    yield return current.ToString().Trim();
                    current.Clear();
                }

                if (Encoding.UTF8.GetByteCount(part) <= maxBytes)
                {
                    current.Append(part);
                    continue;
                }

                // Split by words if still too large.
                var words = part.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var buf = new StringBuilder();
                foreach (var w in words)
                {
                    var cand = buf.Length == 0 ? w : $"{buf} {w}";
                    if (Encoding.UTF8.GetByteCount(cand) <= maxBytes)
                    {
                        buf.Clear();
                        buf.Append(cand);
                        continue;
                    }

                    if (buf.Length > 0)
                    {
                        yield return buf.ToString();
                        buf.Clear();
                    }

                    if (Encoding.UTF8.GetByteCount(w) > maxBytes)
                    {
                        // Hard cut
                        var hard = w;
                        while (!string.IsNullOrEmpty(hard))
                        {
                            var take = Math.Min(hard.Length, 512);
                            while (take > 1 && Encoding.UTF8.GetByteCount(hard.Substring(0, take)) > maxBytes)
                                take /= 2;
                            yield return hard.Substring(0, take);
                            hard = hard.Substring(take);
                        }
                    }
                    else
                    {
                        buf.Append(w);
                    }
                }

                if (buf.Length > 0)
                    yield return buf.ToString();
            }

            if (current.Length > 0)
                yield return current.ToString().Trim();
        }

        // -----------------------------
        // Step C: Stitch MP3 segments
        // -----------------------------
        private static byte[] StitchMp3Segments(IReadOnlyList<byte[]> mp3Segments)
        {
            if (mp3Segments.Count == 0)
                return Array.Empty<byte>();

            using var output = new MemoryStream();
            foreach (var seg in mp3Segments)
            {
                if (seg == null || seg.Length == 0)
                    continue;

                using var segStream = new MemoryStream(seg);
                foreach (var frame in ReadMp3Frames(segStream))
                {
                    output.Write(frame.RawData, 0, frame.RawData.Length);
                }
            }
            return output.ToArray();
        }

        private static double AppendMp3ToOutputAndGetDurationSeconds(byte[] mp3Bytes, Stream output)
        {
            if (mp3Bytes == null || mp3Bytes.Length == 0)
                return 0;

            double seconds = 0;
            using var segStream = new MemoryStream(mp3Bytes);
            foreach (var frame in ReadMp3Frames(segStream))
            {
                output.Write(frame.RawData, 0, frame.RawData.Length);

                // Duration from actual frames for best alignment with the stitched MP3.
                if (frame.SampleRate > 0 && frame.SampleCount > 0)
                {
                    seconds += frame.SampleCount / (double)frame.SampleRate;
                }
            }
            return seconds;
        }

        /// <summary>
        /// Cross-platform MP3 frame reader that skips ID3v2 tags and reads raw MP3 frames without relying on
        /// Windows ACM codecs (Msacm32.dll). This is safe on Linux (Render).
        /// </summary>
        private static IEnumerable<Mp3Frame> ReadMp3Frames(Stream stream)
        {
            if (stream == null) yield break;

            if (stream.CanSeek)
                stream.Position = 0;

            SkipId3v2TagIfPresent(stream);

            while (true)
            {
                Mp3Frame? frame = null;
                try
                {
                    frame = Mp3Frame.LoadFromStream(stream);
                }
                catch (EndOfStreamException)
                {
                    yield break;
                }
                catch
                {
                    // If the stream is not positioned at a valid frame boundary, stop gracefully.
                    yield break;
                }

                if (frame == null)
                    yield break;

                yield return frame;
            }
        }

        private static void SkipId3v2TagIfPresent(Stream stream)
        {
            if (stream == null || !stream.CanSeek) return;

            var start = stream.Position;
            var header = new byte[10];
            var read = stream.Read(header, 0, header.Length);
            if (read < header.Length)
            {
                stream.Position = start;
                return;
            }

            // ID3v2 header: "ID3" + ver(2) + flags(1) + size(4 synchsafe)
            if (header[0] == (byte)'I' && header[1] == (byte)'D' && header[2] == (byte)'3')
            {
                var size =
                    ((header[6] & 0x7F) << 21) |
                    ((header[7] & 0x7F) << 14) |
                    ((header[8] & 0x7F) << 7) |
                    (header[9] & 0x7F);

                stream.Position = start + 10 + size;
                return;
            }

            // Not an ID3 tag; rewind.
            stream.Position = start;
        }
    }
}
