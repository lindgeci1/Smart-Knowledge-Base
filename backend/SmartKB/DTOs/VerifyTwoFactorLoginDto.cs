namespace SmartKB.DTOs
{
    public class VerifyTwoFactorLoginDto
    {
        public string TempToken { get; set; } = ""; // Short-lived token from login step 1
        public string Code { get; set; } = "";      // 6-digit TOTP code
    }
}
