import jsPDF from "jspdf";

export const downloadData = (
  data: any[],
  filename: string,
  format: "excel" | "pdf" | "json",
  showFullValues = false
) => {
  if (data.length === 0) {
    alert("No data to download");
    return;
  }

  if (format === "json") {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } else if (format === "excel") {
    // Convert to CSV (Excel can open CSV)
    const headers = Object.keys(data[0] || {});
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row];
            if (value === null || value === undefined) return "";
            const stringValue = String(value);
            return stringValue.includes(",") ||
              stringValue.includes('"') ||
              stringValue.includes("\n")
              ? `"${stringValue.replace(/"/g, '""')}"`
              : stringValue;
          })
          .join(",")
      ),
    ];
    const csv = csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else if (format === "pdf") {
    // Create proper PDF using jsPDF
    const doc = new jsPDF("landscape"); // Use landscape for better table display
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const startY = 15;
    let y = startY;
    const lineHeight = 6;
    const maxWidth = pageWidth - 2 * margin;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    const title = `${
      filename.charAt(0).toUpperCase() + filename.slice(1).replace(/-/g, " ")
    } Report`;
    doc.text(title, margin, y);
    y += lineHeight * 1.5;

    // Date
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += lineHeight * 1.5;

    // Table headers
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const colCount = headers.length;

      // Calculate column widths based on content and filename
      let colWidths: number[];
      if (filename === "packages") {
        // Packages: Individual width variables for each column - adjust as needed
        const nameWidth = maxWidth * 0.15; // Name column width
        const descriptionWidth = maxWidth * 0.2; // Description column width
        const priceWidth = maxWidth * 0.08; // Price column width
        const priceTypeWidth = maxWidth * 0.1; // Price Type column width
        const summaryLimitWidth = maxWidth * 0.12; // Summary Limit column width
        const isPopularWidth = maxWidth * 0.08; // Is Popular column width
        const statusWidth = maxWidth * 0.08; // Status column width
        const createdAtWidth = maxWidth * 0.16; // Created At column width

        // Map each header to its specific width
        const widthMap: Record<string, number> = {
          Name: nameWidth,
          Description: descriptionWidth,
          Price: priceWidth,
          "Price Type": priceTypeWidth,
          "Summary Limit": summaryLimitWidth,
          "Is Popular": isPopularWidth,
          Status: statusWidth,
          "Created At": createdAtWidth,
        };

        // Calculate total width used by defined columns
        const definedWidth = headers.reduce((sum, header) => {
          return sum + (widthMap[header] || 0);
        }, 0);

        // Calculate remaining width for any undefined columns
        const remainingWidth = maxWidth - definedWidth;
        const undefinedCols = headers.filter((header) => !widthMap[header]);
        const defaultWidth =
          undefinedCols.length > 0 ? remainingWidth / undefinedCols.length : 0;

        colWidths = headers.map((header) => {
          return widthMap[header] || defaultWidth;
        });
      } else if (filename === "payments") {
        // Payments: Individual width variables for each column - adjust as needed
        const packageWidth = maxWidth * 0.1; // Package column width
        const customerWidth = maxWidth * 0.12; // Customer column width
        const emailWidth = maxWidth * 0.17; // Email column width
        const amountWidth = maxWidth * 0.07; // Amount column width
        const statusWidth = maxWidth * 0.07; // Status column width
        const paymentDateWidth = maxWidth * 0.13; // Payment Date column width
        const refundDateWidth = maxWidth * 0.13; // Refund Date column width
        const methodWidth = maxWidth * 0.06; // Method column width
        const declineReasonWidth = maxWidth * 0.11; // Decline Reason column width

        // Map each header to its specific width
        const widthMap: Record<string, number> = {
          Package: packageWidth,
          Customer: customerWidth,
          Email: emailWidth,
          Amount: amountWidth,
          Status: statusWidth,
          "Payment Date": paymentDateWidth,
          "Refund Date": refundDateWidth,
          Method: methodWidth,
          "Decline Reason": declineReasonWidth,
        };

        // Calculate total width used by defined columns
        const definedWidth = headers.reduce((sum, header) => {
          return sum + (widthMap[header] || 0);
        }, 0);

        // Calculate remaining width for any undefined columns
        const remainingWidth = maxWidth - definedWidth;
        const undefinedCols = headers.filter((header) => !widthMap[header]);
        const defaultWidth =
          undefinedCols.length > 0 ? remainingWidth / undefinedCols.length : 0;

        colWidths = headers.map((header) => {
          return widthMap[header] || defaultWidth;
        });
      } else {
        // Default: equal width for all columns
        colWidths = headers.map(() => maxWidth / colCount);
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      let currentX = margin;
      headers.forEach((header, index) => {
        let headerText =
          header.length > 15 ? header.substring(0, 15) + "..." : header;
        // Special handling for narrow columns to prevent overlap
        if (header === "Is Popular") {
          headerText = "Popular"; // Shorter text for narrow column
        }
        doc.text(headerText, currentX, y);
        currentX += colWidths[index];
      });
      y += lineHeight;

      // Draw line under headers
      doc.setLineWidth(0.5);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 2;

      // Table rows
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      data.forEach((row, rowIndex) => {
        // Check if we need a new page before starting this row
        if (y > pageHeight - 20) {
          doc.addPage();
          y = startY;
        }

        let rowStartY = y;
        const cellLines: string[][] = [];
        let maxLines = 1;

        // Determine if this row should be gray (alternating)
        const isGrayRow = rowIndex % 2 === 1;

        // First pass: calculate how many lines each cell needs
        headers.forEach((header, colIndex) => {
          const value = String(row[header] || "");
          const lines: string[] = [];
          const cellWidth = colWidths[colIndex];

          if (showFullValues) {
            // Split long values into multiple lines
            const maxCharsPerLine = Math.floor((cellWidth - 2) / 1.5); // Approximate chars per line based on font size
            const words = value.split(" ");
            let currentLine = "";

            words.forEach((word) => {
              const testLine = currentLine ? currentLine + " " + word : word;
              if (testLine.length <= maxCharsPerLine) {
                currentLine = testLine;
              } else {
                if (currentLine) {
                  lines.push(currentLine);
                }
                // If word is too long, split it by characters
                if (word.length > maxCharsPerLine) {
                  for (let i = 0; i < word.length; i += maxCharsPerLine) {
                    lines.push(word.substring(i, i + maxCharsPerLine));
                  }
                  currentLine = "";
                } else {
                  currentLine = word;
                }
              }
            });
            if (currentLine) {
              lines.push(currentLine);
            }
            if (lines.length === 0 && value) {
              lines.push(value);
            }
          } else {
            // Truncate long values (for text summaries)
            const displayValue =
              value.length > 15 ? value.substring(0, 15) + "..." : value;
            lines.push(displayValue);
          }

          cellLines.push(lines);
          maxLines = Math.max(maxLines, lines.length);
        });

        // Draw background for gray rows
        if (isGrayRow && maxLines > 0) {
          const rowHeight = maxLines * lineHeight;
          doc.setFillColor(240, 240, 240); // Light gray color
          doc.rect(
            margin,
            rowStartY - lineHeight + 2,
            maxWidth,
            rowHeight,
            "F"
          );
        }

        // Second pass: draw all cells with proper line wrapping
        for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
          // Check if we need a new page for this line
          if (y > pageHeight - 15) {
            doc.addPage();
            y = startY;
            rowStartY = startY;
            // Redraw background if needed after page break
            if (isGrayRow && lineIndex < maxLines) {
              const remainingHeight = (maxLines - lineIndex) * lineHeight;
              doc.setFillColor(240, 240, 240);
              doc.rect(
                margin,
                rowStartY - lineHeight + 2,
                maxWidth,
                remainingHeight,
                "F"
              );
            }
          }

          let currentX = margin;
          headers.forEach((_, colIndex) => {
            const lines = cellLines[colIndex];
            const line = lines[lineIndex] || "";
            doc.text(line, currentX, y);
            currentX += colWidths[colIndex];
          });

          y += lineHeight;
        }
      });
    } else {
      doc.setFontSize(10);
      doc.text("No data available", margin, y);
    }

    // Save PDF
    doc.save(`${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
  }
};
