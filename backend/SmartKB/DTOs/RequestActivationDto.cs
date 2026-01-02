using System.ComponentModel.DataAnnotations;

namespace SmartKB.DTOs
{
    public class RequestActivationDto
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [MaxLength(255, ErrorMessage = "Email must not exceed 255 characters")]
        public string Email { get; set; }
    }
}

