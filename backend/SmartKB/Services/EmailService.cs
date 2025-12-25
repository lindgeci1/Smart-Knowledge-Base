using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace SmartKB.Services
{
    public class EmailService
    {
        private readonly string _smtpServer;
        private readonly int _smtpPort;
        private readonly string _smtpUsername;
        private readonly string _smtpPassword;
        private readonly string _fromEmail;
        private readonly string _fromName;

        public EmailService(IConfiguration config)
        {
            _smtpServer = Environment.GetEnvironmentVariable("SMTP_SERVER")
                ?? config["SmtpSettings:Server"]
                ?? "smtp.gmail.com";
            
            var portStr = Environment.GetEnvironmentVariable("SMTP_PORT")
                ?? config["SmtpSettings:Port"]
                ?? "587";
            _smtpPort = int.Parse(portStr);
            
            _smtpUsername = Environment.GetEnvironmentVariable("SMTP_USERNAME")
                ?? config["SmtpSettings:Username"]
                ?? throw new Exception("SMTP_USERNAME not configured");
            
            _smtpPassword = Environment.GetEnvironmentVariable("SMTP_PASSWORD")
                ?? config["SmtpSettings:Password"]
                ?? throw new Exception("SMTP_PASSWORD not configured");
            
            _fromEmail = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL")
                ?? config["SmtpSettings:FromEmail"]
                ?? _smtpUsername;
            
            _fromName = Environment.GetEnvironmentVariable("SMTP_FROM_NAME")
                ?? config["SmtpSettings:FromName"]
                ?? "Smart Knowledge Base";
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string resetCode)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Password Reset Code - Smart Knowledge Base";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
                            <h2 style='color: #4f46e5; margin-bottom: 20px;'>Password Reset Request</h2>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6;'>
                                You requested to reset your password for your Smart Knowledge Base account.
                            </p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6;'>
                                Your password reset code is:
                            </p>
                            <div style='background-color: #f3f4f6; padding: 30px; text-align: center; margin: 30px 0; border-radius: 8px; border: 2px solid #e5e7eb;'>
                                <h1 style='color: #1f2937; font-size: 36px; letter-spacing: 8px; margin: 0; font-weight: bold;'>{resetCode}</h1>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6;'>
                                This code will expire in <strong>5 minutes</strong>.
                            </p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 20px;'>
                                If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
                            </p>
                            <hr style='border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;' />
                            <p style='color: #9ca3af; font-size: 12px; text-align: center; margin: 0;'>
                                Smart Knowledge Base
                            </p>
                        </div>",
                    TextBody = $"Your password reset code is: {resetCode}. This code will expire in 5 minutes. If you didn't request this, please ignore this email."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string username)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Welcome to SummarizeAI";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
                            <h2 style='color: #4f46e5; margin-bottom: 20px;'>Welcome to SummarizeAI!</h2>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6;'>
                                Hello {username},
                            </p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6;'>
                                Thank you for joining SummarizeAI! Your account has been successfully created.
                            </p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6;'>
                                You can now start using our AI-powered summarization features to make your work more efficient.
                            </p>
                            <div style='background-color: #f3f4f6; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px; border: 2px solid #e5e7eb;'>
                                <p style='color: #1f2937; font-size: 16px; margin: 0; font-weight: 600;'>Get Started</p>
                                <p style='color: #6b7280; font-size: 14px; margin: 10px 0 0 0;'>Log in to your dashboard and start summarizing!</p>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 20px;'>
                                If you have any questions or need assistance, feel free to reach out to our support team.
                            </p>
                            <hr style='border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;' />
                            <p style='color: #9ca3af; font-size: 12px; text-align: center; margin: 0;'>
                                SummarizeAI
                            </p>
                        </div>",
                    TextBody = $"Welcome to SummarizeAI!\n\nHello {username},\n\nThank you for joining SummarizeAI! Your account has been successfully created. You can now start using our AI-powered summarization features.\n\nGet started by logging in to your dashboard.\n\nSummarizeAI"
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }

        public async Task SendPasswordChangedEmailAsync(string toEmail, string username)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Password Changed Successfully - SummarizeAI";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
                            <h2 style='color: #4f46e5; margin-bottom: 20px;'>Password Changed Successfully</h2>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6;'>
                                Hello {username},
                            </p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6;'>
                                This email confirms that your password has been successfully changed for your SummarizeAI account.
                            </p>
                            <div style='background-color: #d1fae5; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px; border: 2px solid #10b981;'>
                                <p style='color: #065f46; font-size: 16px; margin: 0; font-weight: 600;'>✓ Password Updated</p>
                                <p style='color: #047857; font-size: 14px; margin: 10px 0 0 0;'>Your account is now secured with your new password.</p>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 20px;'>
                                <strong>Important:</strong> If you did not make this change, please contact our support team immediately to secure your account.
                            </p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6;'>
                                For security reasons, we recommend using a strong, unique password that you don't use for other accounts.
                            </p>
                            <hr style='border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;' />
                            <p style='color: #9ca3af; font-size: 12px; text-align: center; margin: 0;'>
                                SummarizeAI
                            </p>
                        </div>",
                    TextBody = $"Password Changed Successfully\n\nHello {username},\n\nThis email confirms that your password has been successfully changed for your SummarizeAI account.\n\nIf you did not make this change, please contact our support team immediately.\n\nSummarizeAI"
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }
    }
}


