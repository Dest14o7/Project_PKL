import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportRekapGaji = (gajiData, periode) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Rekap Gaji Karyawan", 14, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`S&D Project (Swakarya Niskala Djaya)`, 14, 22);
  doc.text(`Periode: ${periode}`, 14, 28);

  // Tabel
  const rows = gajiData.map(g => [
    g.nama,
    g.dept,
    `${g.totalJamKerja.toFixed(1)} jam`,
    `Rp ${g.gajiPokok.toLocaleString("id-ID")}`,
  ]);

  // Total
  const totalGaji = gajiData.reduce((sum, g) => sum + g.gajiPokok, 0);

  autoTable(doc, {
    startY: 33,
    head: [["Nama", "Departemen", "Jam Kerja", "Total Gaji"]],
    body: rows,
    foot: [["", "", "TOTAL", `Rp ${totalGaji.toLocaleString("id-ID")}`]],
    headStyles: { fillColor: [111, 78, 55], textColor: 255 },
    footStyles: { fillColor: [236, 177, 118], textColor: [111, 78, 55], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 250, 245] },
    styles: { fontSize: 9 },
  });

  doc.save(`rekap_gaji_${new Date().toISOString().slice(0, 7)}.pdf`);
};