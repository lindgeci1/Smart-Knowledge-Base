using SendGrid;
using SendGrid.Helpers.Mail;

namespace SmartKB.Services
{
    public class EmailService
    {
        private readonly SendGridClient _sendGridClient;
        private readonly string _fromEmail;
        private readonly string _fromName;

        private readonly string _contactEmail;

        public EmailService(IConfiguration config)
        {
            var apiKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY")
                ?? config["SendGrid:ApiKey"]
                ?? throw new Exception("SENDGRID_API_KEY not configured");

            _sendGridClient = new SendGridClient(apiKey);

            _fromEmail = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL")
                ?? config["SendGrid:FromEmail"]
                ?? throw new Exception("SMTP_FROM_EMAIL not configured");

            _fromName = Environment.GetEnvironmentVariable("SMTP_FROM_NAME")
                ?? config["SendGrid:FromName"]
                ?? "Smart Knowledge Base";

            _contactEmail = Environment.GetEnvironmentVariable("CONTACT_EMAIL")
                ?? config["ContactEmail"]
                ?? _fromEmail;
        }

        private async Task SendEmailAsync(string toEmail, string subject, string textBody, string htmlBody)
        {
            var from = new EmailAddress(_fromEmail, _fromName);
            var to = new EmailAddress(toEmail);
            var message = MailHelper.CreateSingleEmail(from, to, subject, textBody, htmlBody);

            var response = await _sendGridClient.SendEmailAsync(message);
            if ((int)response.StatusCode >= 400)
            {
                var errorBody = await response.Body.ReadAsStringAsync();
                throw new Exception($"SendGrid send failed: {response.StatusCode} {errorBody}");
            }
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string resetCode)
        {
            var subject = "Reset Your Password";
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var resetLink = $"{frontendUrl}/reset-password";

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Reset Your Password</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi,</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>You requested to reset your password for your Smart Knowledge Base account. If you didn't request a new password, you can safely delete this email.</p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 32px 0 0 0;'>Your reset code is: <strong style='color: #1f2937; font-size: 18px; letter-spacing: 2px;'>{resetCode}</strong></p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;'>This code will expire in 5 minutes.</p>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{resetLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Reset Password</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{resetLink}' style='color: #2563eb; text-decoration: underline;'>{resetLink}</a></p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Reset Your Password\n\nHi,\n\nYou requested to reset your password for your Smart Knowledge Base account. If you didn't request a new password, you can safely delete this email.\n\nYour reset code is: {resetCode}\nThis code will expire in 5 minutes.\n\nReset Password: {resetLink}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string username)
        {
            var subject = "Welcome to Smart Knowledge Base";
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var loginLink = $"{frontendUrl}/login";

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Welcome to Smart Knowledge Base</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {username},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>Thank you for joining Smart Knowledge Base! Your account has been successfully created. You can now start using our AI-powered summarization features to make your work more efficient.</p>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{loginLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Get Started</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{loginLink}' style='color: #2563eb; text-decoration: underline;'>{loginLink}</a></p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Welcome to Smart Knowledge Base\n\nHi {username},\n\nThank you for joining Smart Knowledge Base! Your account has been successfully created. You can now start using our AI-powered summarization features.\n\nGet Started: {loginLink}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPasswordChangedEmailAsync(string toEmail, string username)
        {
            var subject = "Password Changed Successfully";
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var loginLink = $"{frontendUrl}/login";

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Password Changed Successfully</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {username},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>This email confirms that your password has been successfully changed for your Smart Knowledge Base account. If you did not make this change, please contact our support team immediately to secure your account.</p>
                            <div style='background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;'>
                                <p style='color: #991b1b; font-size: 14px; line-height: 1.6; margin: 0;'><strong>Security Notice:</strong></p>
                                <p style='color: #991b1b; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;'>If you did not make this change, please contact our support team immediately at <a href='mailto:{_contactEmail}' style='color: #dc2626; text-decoration: underline;'>{_contactEmail}</a> to secure your account.</p>
                            </div>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{loginLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Sign In</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{loginLink}' style='color: #2563eb; text-decoration: underline;'>{loginLink}</a></p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Password Changed Successfully\n\nHi {username},\n\nThis email confirms that your password has been successfully changed for your Smart Knowledge Base account. If you did not make this change, please contact our support team immediately to secure your account.\n\nSecurity Notice:\nIf you did not make this change, please contact our support team immediately at {_contactEmail} to secure your account.\n\nSign In: {loginLink}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPaymentConfirmationEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, DateTime paidAt)
        {
            var subject = "Payment Confirmation";
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var dashboardLink = $"{frontendUrl}/dashboard";
            var formattedAmount = amount.ToString("F2");
            var formattedDate = paidAt.ToString("MMMM dd, yyyy 'at' HH:mm UTC");

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Payment Confirmation</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {customerName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>Thank you for your purchase! Your payment has been successfully processed. Your package has been activated and is ready to use.</p>
                            <div style='background-color: #f9fafb; padding: 20px; margin: 32px 0; border-radius: 6px; border: 1px solid #e5e7eb;'>
                                <table style='width: 100%; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 8px 0; color: #6b7280; font-size: 14px;'>Package:</td>
                                        <td style='padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{packageName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 8px 0; color: #6b7280; font-size: 14px;'>Amount:</td>
                                        <td style='padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{currency} {formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 8px 0; color: #6b7280; font-size: 14px;'>Payment Date:</td>
                                        <td style='padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;'>{formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 8px 0; color: #6b7280; font-size: 14px;'>Payment ID:</td>
                                        <td style='padding: 8px 0; color: #1f2937; font-size: 12px; text-align: right; font-family: monospace;'>{paymentId}</td>
                                    </tr>
                                </table>
                            </div>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{dashboardLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Go to Dashboard</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{dashboardLink}' style='color: #2563eb; text-decoration: underline;'>{dashboardLink}</a></p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Payment Confirmation\n\nHi {customerName},\n\nThank you for your purchase! Your payment has been successfully processed. Your package has been activated and is ready to use.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment Date: {formattedDate}\nPayment ID: {paymentId}\n\nGo to Dashboard: {dashboardLink}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPaymentFailedEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, string? declineReason)
        {
            var subject = "Payment Failed";
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var packagesLink = $"{frontendUrl}/packages";
            var formattedAmount = amount.ToString("F2");
            var reasonLine = string.IsNullOrWhiteSpace(declineReason)
                ? "No specific decline reason was provided."
                : declineReason;

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Payment Failed</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {customerName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>We couldn't process your payment. Please try again or use a different card.</p>
                            <div style='background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px; border: 1px solid #e5e7eb;'>
                                <table style='width: 100%; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Package:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{packageName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Amount:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{currency} {formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Payment ID:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 12px; text-align: right; font-family: monospace;'>{paymentId}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Decline Reason:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; text-align: right;'>{reasonLine}</td>
                                    </tr>
                                </table>
                            </div>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{packagesLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Try Again</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{packagesLink}' style='color: #2563eb; text-decoration: underline;'>{packagesLink}</a></p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Payment Failed\n\nHi {customerName},\n\nWe couldn't process your payment. Please try again or use a different card.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment ID: {paymentId}\nDecline Reason: {reasonLine}\n\nTry Again: {packagesLink}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPaymentIncompleteEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId)
        {
            var subject = "Payment Not Completed";
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var packagesLink = $"{frontendUrl}/packages";
            var formattedAmount = amount.ToString("F2");

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Payment Not Completed</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {customerName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Your payment was not completed. Please try again to finish your purchase.</p>
                            <div style='background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px; border: 1px solid #e5e7eb;'>
                                <table style='width: 100%; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Package:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{packageName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Amount:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{currency} {formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Payment ID:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 12px; text-align: right; font-family: monospace;'>{paymentId}</td>
                                    </tr>
                                </table>
                            </div>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{packagesLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Complete Purchase</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{packagesLink}' style='color: #2563eb; text-decoration: underline;'>{packagesLink}</a></p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Payment Not Completed\n\nHi {customerName},\n\nYour payment was not completed. Please try again to finish your purchase.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment ID: {paymentId}\n\nComplete Purchase: {packagesLink}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPaymentRefundedEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, DateTime refundedAt)
        {
            var subject = "Payment Refunded";
            var formattedAmount = amount.ToString("F2");
            var formattedDate = refundedAt.ToString("MMMM dd, yyyy 'at' HH:mm UTC");

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Payment Refunded</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {customerName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Your payment has been refunded.</p>
                            <div style='background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px; border: 1px solid #e5e7eb;'>
                                <table style='width: 100%; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Package:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{packageName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Amount:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{currency} {formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Refund Date:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; text-align: right;'>{formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Payment ID:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 12px; text-align: right; font-family: monospace;'>{paymentId}</td>
                                    </tr>
                                </table>
                            </div>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Payment Refunded\n\nHi {customerName},\n\nYour payment has been refunded.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nRefund Date: {formattedDate}\nPayment ID: {paymentId}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendAccountDeactivatedEmailAsync(string toEmail, string username)
        {
            var subject = "Account Deactivated";
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var statusLine = "Your account has been deactivated by an administrator. If you believe this is a mistake, you can request account activation.";
            var requestLink = $"{frontendUrl}/request-activation";

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Account Deactivated</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {username},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>{statusLine}</p>
                            <div style='background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;'>
                                <p style='color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;'><strong>Request Account Activation:</strong></p>
                                <p style='color: #92400e; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;'>If you believe your account was deactivated by mistake, you can submit a request to have it reactivated. Our administrators will review your request and get back to you.</p>
                            </div>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{requestLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Request Activation</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 24px 0; word-break: break-all;'><a href='{requestLink}' style='color: #2563eb; text-decoration: underline;'>{requestLink}</a></p>
                            <div style='background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 24px 0; border-radius: 4px;'>
                                <p style='color: #374151; font-size: 14px; line-height: 1.6; margin: 0;'><strong>Need to contact us?</strong></p>
                                <p style='color: #374151; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;'>If you have any questions or need assistance, please contact our support team at <a href='mailto:{_contactEmail}' style='color: #2563eb; text-decoration: underline;'>{_contactEmail}</a>.</p>
                            </div>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Account Deactivated\n\nHi {username},\n\n{statusLine}\n\nRequest Account Activation:\nIf you believe your account was deactivated by mistake, you can submit a request to have it reactivated. Our administrators will review your request and get back to you.\n\nRequest Activation: {requestLink}\n\nNeed to contact us?\nIf you have any questions or need assistance, please contact our support team at {_contactEmail}.\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendActivationRequestReceivedEmailAsync(string toEmail, string? username)
        {
            var subject = "Activation Request Received";
            var displayName = username ?? toEmail;

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Activation Request Received</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {displayName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Thank you for submitting your account activation request. We have received your request and it is now being reviewed by our administrators.</p>
                            <div style='background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;'>
                                <p style='color: #1e40af; font-size: 14px; line-height: 1.6; margin: 0;'><strong>What happens next?</strong></p>
                                <ul style='color: #1e40af; font-size: 14px; line-height: 1.8; margin: 8px 0 0 0; padding-left: 20px;'>
                                    <li>Our team will review your request</li>
                                    <li>You will receive an email notification once a decision has been made</li>
                                    <li>If approved, your account will be reactivated and you can sign in</li>
                                </ul>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>We appreciate your patience while we process your request.</p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Activation Request Received\n\nHi {displayName},\n\nThank you for submitting your account activation request. We have received your request and it is now being reviewed by our administrators.\n\nWhat happens next?\n- Our team will review your request\n- You will receive an email notification once a decision has been made\n- If approved, your account will be reactivated and you can sign in\n\nWe appreciate your patience while we process your request.\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendActivationRequestApprovedEmailAsync(string toEmail, string? username)
        {
            var subject = "Activation Request Approved";
            var displayName = username ?? toEmail;
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var loginLink = $"{frontendUrl}/login";

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Activation Request Approved</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {displayName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Great news! Your account activation request has been approved by an administrator.</p>
                            <div style='background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 24px 0; border-radius: 4px;'>
                                <p style='color: #166534; font-size: 14px; line-height: 1.6; margin: 0;'><strong>Your account has been reactivated!</strong></p>
                                <p style='color: #166534; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;'>You can now sign in to your account and continue using Smart Knowledge Base.</p>
                            </div>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{loginLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Sign In</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{loginLink}' style='color: #2563eb; text-decoration: underline;'>{loginLink}</a></p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Activation Request Approved\n\nHi {displayName},\n\nGreat news! Your account activation request has been approved by an administrator.\n\nYour account has been reactivated! You can now sign in to your account and continue using Smart Knowledge Base.\n\nSign In: {loginLink}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendActivationRequestRejectedEmailAsync(string toEmail, string? username)
        {
            var subject = "Activation Request Status Update";
            var displayName = username ?? toEmail;
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var requestLink = $"{frontendUrl}/request-activation";

            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Activation Request Status Update</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {displayName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>We have reviewed your account activation request. Unfortunately, your request has been declined at this time.</p>
                            <div style='background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;'>
                                <p style='color: #991b1b; font-size: 14px; line-height: 1.6; margin: 0;'><strong>Need assistance?</strong></p>
                                <p style='color: #991b1b; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;'>If you have questions about this decision or would like to discuss your account status further, please contact our support team at <a href='mailto:{_contactEmail}' style='color: #dc2626; text-decoration: underline;'>{_contactEmail}</a>.</p>
                            </div>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{requestLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Submit New Request</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{requestLink}' style='color: #2563eb; text-decoration: underline;'>{requestLink}</a></p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>Thank you for your understanding.</p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Activation Request Status Update\n\nHi {displayName},\n\nWe have reviewed your account activation request. Unfortunately, your request has been declined at this time.\n\nNeed assistance?\nIf you have questions about this decision or would like to discuss your account status further, please contact our support team at {_contactEmail}.\n\nSubmit New Request: {requestLink}\n\nThank you for your understanding.\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }
    }
}
