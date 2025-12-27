import jsPDF from "jspdf";

export const downloadData = (
  data: any[],
  filename: string,
  format: "excel" | "pdf" | "json"
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
            return stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")
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
    const title = `${filename.charAt(0).toUpperCase() + filename.slice(1).replace(/-/g, " ")} Report`;
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
      const colCount = Math.min(headers.length, 8); // Limit columns for readability
      const colWidth = maxWidth / colCount;
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      headers.slice(0, colCount).forEach((header, index) => {
        const x = margin + index * colWidth;
        const headerText = header.length > 12 ? header.substring(0, 12) + "..." : header;
        doc.text(headerText, x, y);
      });
      y += lineHeight;

      // Draw line under headers
      doc.setLineWidth(0.5);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 2;

      // Table rows
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      data.forEach((row) => {
        // Check if we need a new page
        if (y > pageHeight - 15) {
          doc.addPage();
          y = startY;
        }

        headers.slice(0, colCount).forEach((header, colIndex) => {
          const x = margin + colIndex * colWidth;
          const value = String(row[header] || "");
          // Truncate long values
          const displayValue = value.length > 15 ? value.substring(0, 15) + "..." : value;
          doc.text(displayValue, x, y);
        });
        y += lineHeight;
      });
    } else {
      doc.setFontSize(10);
      doc.text("No data available", margin, y);
    }

    // Save PDF
    doc.save(`${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
  }
};

