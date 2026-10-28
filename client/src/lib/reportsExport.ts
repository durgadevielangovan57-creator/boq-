import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ColumnDef {
  header: string;
  key: string;
  format?: "currency" | "date" | "number" | "text" | "percentage";
  width?: number;
}

/**
 * Format Indian currency: ₹ 1,23,456.78
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "₹0.00";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "₹0.00";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Format compact Indian currency: ₹1.2 Cr, ₹45.6 L, ₹12.5 K
 */
export function formatCompactCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "₹0";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "₹0";

  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum >= 10000000) {
    return `${sign}₹${(absNum / 10000000).toFixed(2)} Cr`;
  }
  if (absNum >= 100000) {
    return `${sign}₹${(absNum / 100000).toFixed(2)} L`;
  }
  if (absNum >= 1000) {
    return `${sign}₹${(absNum / 1000).toFixed(1)} K`;
  }
  return `${sign}₹${absNum.toFixed(0)}`;
}

/**
 * Format date nicely: 27 Oct 2026 or 27/10/2026
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Export data to Excel (.xlsx) file
 */
export function exportToExcel(
  filename: string,
  sheetTitle: string,
  columns: ColumnDef[],
  rows: any[]
) {
  try {
    const exportData = rows.map((row, idx) => {
      const formattedRow: Record<string, any> = { "#": idx + 1 };
      columns.forEach((col) => {
        const val = row[col.key];
        if (col.format === "currency") {
          formattedRow[col.header] = formatCurrency(val);
        } else if (col.format === "date") {
          formattedRow[col.header] = formatDate(val);
        } else if (col.format === "percentage") {
          formattedRow[col.header] = val ? `${val}%` : "0%";
        } else {
          formattedRow[col.header] = val !== null && val !== undefined ? val : "-";
        }
      });
      return formattedRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.slice(0, 31));

    // Auto-fit column widths
    const colWidths = [{ wch: 6 }];
    columns.forEach((col) => {
      colWidths.push({ wch: Math.max(col.header.length + 4, col.width || 15) });
    });
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, `${filename.replace(/\.xlsx$/i, "")}.xlsx`);
  } catch (err) {
    console.error("Export to Excel failed:", err);
    alert("Export to Excel encountered an error. Please try again.");
  }
}

/**
 * Export data to CSV (.csv) file
 */
export function exportToCsv(
  filename: string,
  columns: ColumnDef[],
  rows: any[]
) {
  try {
    const headers = ["#", ...columns.map((c) => `"${c.header.replace(/"/g, '""')}"`)].join(",");
    const csvRows = rows.map((row, idx) => {
      const line = [
        idx + 1,
        ...columns.map((col) => {
          let val = row[col.key];
          if (col.format === "currency") {
            val = formatCurrency(val);
          } else if (col.format === "date") {
            val = formatDate(val);
          } else if (col.format === "percentage") {
            val = val ? `${val}%` : "0%";
          }
          const str = val !== null && val !== undefined ? String(val) : "";
          return `"${str.replace(/"/g, '""')}"`;
        }),
      ];
      return line.join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...csvRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename.replace(/\.csv$/i, "")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Export to CSV failed:", err);
    alert("Export to CSV encountered an error. Please try again.");
  }
}

/**
 * Export data to styled PDF (.pdf) file
 */
export function exportToPdf(
  filename: string,
  title: string,
  subtitle: string,
  columns: ColumnDef[],
  rows: any[],
  landscape = true
) {
  try {
    const doc = new jsPDF({
      orientation: landscape ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    const primaryColor: [number, number, number] = [37, 99, 235]; // Royal Blue
    const darkGray: [number, number, number] = [31, 41, 55];

    // Header Background Accent Bar
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 8, "F");

    // Company / Module Branding
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.text("BUILDESTIMATE", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("REPORTS & ANALYTICS", 64, 20);

    // Title & Subtitle
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...darkGray);
    doc.text(title, 14, 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${subtitle} • Generated on ${new Date().toLocaleString("en-IN")}`, 14, 36);

    // Format table headers and rows
    const tableHeaders = ["#", ...columns.map((c) => c.header)];
    const tableBody = rows.map((row, idx) => {
      return [
        idx + 1,
        ...columns.map((col) => {
          const val = row[col.key];
          if (col.format === "currency") {
            return formatCurrency(val);
          }
          if (col.format === "date") {
            return formatDate(val);
          }
          if (col.format === "percentage") {
            return val ? `${val}%` : "0%";
          }
          return val !== null && val !== undefined ? String(val) : "-";
        }),
      ];
    });

    autoTable(doc, {
      startY: 42,
      head: [tableHeaders],
      body: tableBody,
      theme: "striped",
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: darkGray,
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      didDrawPage: (data) => {
        // Footer page numbers
        const pageCount = (doc.internal as any).getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        const str = `Page ${data.pageNumber} of ${pageCount}`;
        doc.text(
          str,
          doc.internal.pageSize.getWidth() - 25,
          doc.internal.pageSize.getHeight() - 8
        );
        doc.text(
          "BuildEstimate Confidential Reports",
          14,
          doc.internal.pageSize.getHeight() - 8
        );
      },
    });

    doc.save(`${filename.replace(/\.pdf$/i, "")}.pdf`);
  } catch (err) {
    console.error("Export to PDF failed:", err);
    alert("Export to PDF encountered an error. Please try again.");
  }
}
