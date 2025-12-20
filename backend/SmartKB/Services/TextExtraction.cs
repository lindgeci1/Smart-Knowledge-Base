using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel; // for XLSX
using NPOI.HSSF.UserModel; // for XLS
using System.IO;
using System.Text;
namespace SmartKB.Services
{
    public class TextExtractor
    {
        public string ExtractText(byte[] fileData, string fileType)
        {
            fileType = fileType.ToLower();

            return fileType switch
            {
                "pdf" => ExtractPdf(fileData),
                "docx" => ExtractDocx(fileData),
                "txt" => Encoding.UTF8.GetString(fileData),
                "xls" => ExtractExcel(fileData, "xls"),
                "xlsx" => ExtractExcel(fileData, "xlsx"),
                _ => throw new Exception("Unsupported file type")
            };
        }

        private string ExtractPdf(byte[] fileData)
        {
            try
            {
                using var mem = new MemoryStream(fileData);
                using var pdf = new PdfDocument(new PdfReader(mem));

                var sb = new StringBuilder();
                for (int i = 1; i <= pdf.GetNumberOfPages(); i++)
                {
                    var page = pdf.GetPage(i);
                    var text = PdfTextExtractor.GetTextFromPage(page);
                    sb.AppendLine(text);
                }

                return sb.ToString();
            }
            catch (iText.Kernel.Exceptions.PdfException ex)
            {
                throw new Exception($"Invalid or corrupted file. Please ensure the file is valid file. Error: {ex.Message}");
            }
            catch (Exception ex)
            {
                throw new Exception($"Error reading file: {ex.Message}");
            }
        }

        private string ExtractDocx(byte[] fileData)
        {
            using var mem = new MemoryStream(fileData);
            using var doc = WordprocessingDocument.Open(mem, false);
            return doc.MainDocumentPart.Document.InnerText;
        }

        private string ExtractExcel(byte[] fileData, string fileType)
        {
            using var mem = new MemoryStream(fileData);
            IWorkbook workbook = fileType.ToLower() switch
            {
                "xls" => new HSSFWorkbook(mem),
                "xlsx" => new XSSFWorkbook(mem),
                _ => throw new Exception("Unsupported Excel type")
            };

            var sb = new StringBuilder();

            for (int i = 0; i < workbook.NumberOfSheets; i++)
            {
                var sheet = workbook.GetSheetAt(i);
                for (int r = 0; r <= sheet.LastRowNum; r++)
                {
                    var row = sheet.GetRow(r);
                    if (row == null) continue;

                    foreach (var cell in row.Cells)
                        sb.AppendLine(cell.ToString());
                }
            }

            return sb.ToString();
        }



    }
}
