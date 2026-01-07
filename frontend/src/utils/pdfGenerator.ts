import jsPDF from "jspdf";

interface SummaryData {
  type: "text" | "file";
  summary: string;
  content?: string;
  textName?: string;
  documentName?: string;
  filename?: string;
}

interface GeneratePDFOptions {
  summary: SummaryData;
  title: string;
  documentSource: string;
  authorEmail: string;
}

// Normalize text to remove special Unicode characters
const normalizeText = (text: string): string => {
  return text
    .replace(/[\u2011\u2012\u2013\u2014\u2015]/g, '-') // Replace various dashes with regular hyphen
    .replace(/[\u2018\u2019]/g, "'") // Replace smart quotes with regular quotes
    .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
    .replace(/\u00A0/g, ' ') // Replace non-breaking space with regular space
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .normalize('NFKD') // Normalize Unicode
    .replace(/[^\x00-\x7F]/g, (char) => { // Replace other non-ASCII with closest ASCII
      const replacements: { [key: string]: string } = {
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ñ': 'n', 'ç': 'c'
      };
      return replacements[char] || char;
    });
};

export const generateSummaryPDF = ({ summary, title, documentSource, authorEmail }: GeneratePDFOptions): jsPDF => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxWidth = pageWidth - (2 * margin);
  let yPosition = 15;
  let currentPage = 1;

  // Function to add header
  const addHeader = () => {
    pdf.setDrawColor(100, 100, 100); // Gray color
    pdf.setLineWidth(0.5);
    pdf.line(margin, 10, pageWidth - margin, 10);
  };

  // Function to add footer with page numbers
  const addFooter = (pageNum: number) => {
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.5);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    
    pdf.setFontSize(8);
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(128, 128, 128);
    
    // Left footer - Generated date
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, pageHeight - 7);
    
    // Center footer - Document source
    const sourceText = documentSource.length > 40 ? documentSource.substring(0, 37) + '...' : documentSource;
    const sourceWidth = pdf.getTextWidth(sourceText);
    pdf.text(sourceText, (pageWidth - sourceWidth) / 2, pageHeight - 7);
    
    // Right footer - Page number
    const pageText = `Page ${pageNum}`;
    const pageTextWidth = pdf.getTextWidth(pageText);
    pdf.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 7);
    
    pdf.setTextColor(0, 0, 0); // Reset to black
  };

  // Function to check if we need a new page
  const checkNewPage = (spaceNeeded: number = 8) => {
    if (yPosition > pageHeight - 20 - spaceNeeded) {
      addFooter(currentPage);
      pdf.addPage();
      currentPage++;
      addHeader();
      yPosition = 18;
      return true; // Indicate that a new page was created
    }
    return false;
  };

  // Title Section with background - more compact
  pdf.setFillColor(70, 70, 70); // Dark gray background
  pdf.rect(margin, yPosition - 2, maxWidth, 9, 'F');
  
  pdf.setFontSize(13);
  pdf.setFont(undefined, "bold");
  pdf.setTextColor(255, 255, 255); // White text
  const titleLines = pdf.splitTextToSize(title, maxWidth - 10);
  titleLines.forEach((line: string) => {
    checkNewPage(10);
    pdf.text(line, margin + 3, yPosition + 5);
    yPosition += 6;
  });
  pdf.setTextColor(0, 0, 0); // Reset to black
  yPosition += 6;

  // Metadata Section with light gray background - more compact
  checkNewPage(30);
  pdf.setFillColor(245, 245, 245);
  pdf.rect(margin, yPosition - 3, maxWidth, 22, 'F');
  
  pdf.setFontSize(9);
  pdf.setFont(undefined, "normal");
  pdf.setTextColor(80, 80, 80);
  
  const metaLines = [
    `Generated: ${new Date().toLocaleString()}`,
    `Author: ${authorEmail}`,
    `Source: ${documentSource}`
  ];
  
  metaLines.forEach(line => {
    const wrappedLines = pdf.splitTextToSize(line, maxWidth - 10);
    wrappedLines.forEach((wrappedLine: string) => {
      checkNewPage();
      pdf.text(wrappedLine, margin + 3, yPosition);
      yPosition += 5.5;
    });
  });
  pdf.setTextColor(0, 0, 0);
  yPosition += 10;

  // Original Content Section (if text type)
  if (summary.content && summary.type === "text") {
    checkNewPage(40);
    
    // Section header with border
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
    
    pdf.setFontSize(14);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(70, 70, 70);
    pdf.text("Original Content", margin, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 3;
    
    pdf.setDrawColor(100, 100, 100);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Content with subtle background
    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    const normalizedContent = normalizeText(summary.content);
    const contentLines = pdf.splitTextToSize(normalizedContent, maxWidth - 5);
    
    contentLines.forEach((line: string, index: number) => {
      checkNewPage();
      
      // Alternating line backgrounds for readability
      if (index % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPosition - 4, maxWidth, 6, 'F');
      }
      
      pdf.text(line, margin + 2, yPosition);
      yPosition += 5;
    });
    yPosition += 12;
  }

  // Summary Section
  checkNewPage(40);
  
  // Section header with border
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;
  
  pdf.setFontSize(14);
  pdf.setFont(undefined, "bold");
  pdf.setTextColor(70, 70, 70);
  pdf.text("Summary", margin, yPosition);
  pdf.setTextColor(0, 0, 0);
  yPosition += 3;
  
  pdf.setDrawColor(100, 100, 100);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont(undefined, "normal");
  const normalizedSummary = normalizeText(summary.summary || "No summary available");
  const summaryLines = pdf.splitTextToSize(normalizedSummary, maxWidth - 5);
  
  summaryLines.forEach((line: string, index: number) => {
    const isNewPage = checkNewPage();
    
    // Check if line is a section header (all caps)
    const trimmedLine = line.trim();
    const isHeader = trimmedLine.length > 0 && 
                    trimmedLine === trimmedLine.toUpperCase() && 
                    /[A-Z]/.test(trimmedLine);
    
    if (isHeader) {
      // Add extra spacing before headers (but not if we just created a new page)
      if (index > 0 && !isNewPage) yPosition += 3;
      
      pdf.setFontSize(11);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(70, 70, 70);
      pdf.text(line, margin + 2, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 6;
    } else {
      pdf.setFontSize(10);
      pdf.setFont(undefined, "normal");
      
      // Alternating backgrounds for better readability
      if (index % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPosition - 4, maxWidth, 6, 'F');
      }
      
      pdf.text(line, margin + 2, yPosition);
      yPosition += 5;
    }
  });

  // Add footer to last page
  addFooter(currentPage);

  return pdf;
};
