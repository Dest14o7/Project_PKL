import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { terbilang } from "./terbilang";

export const exportRekapGaji = (gajiData, periode) => {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Rekap Gaji Karyawan", 14, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`S&D Project (Swakarya Niskala Djaya)`, 14, 22);
  doc.text(`Periode: ${periode}`, 14, 28);

  const rows = gajiData.map(g => [
    g.nama,
    g.dept,
    `${(g.totalJamKerja || 0).toFixed(1)} jam`,
    `Rp ${(g.takeHomePay || 0).toLocaleString("id-ID")}`,
  ]);

  const totalGaji = gajiData.reduce((sum, g) => sum + (g.takeHomePay || 0), 0);

  autoTable(doc, {
    startY: 33,
    head: [["Nama", "Departemen", "Jam Kerja", "Take Home Pay"]],
    body: rows,
    foot: [["", "", "TOTAL", `Rp ${totalGaji.toLocaleString("id-ID")}`]],
    headStyles: { fillColor: [111, 78, 55], textColor: 255 },
    footStyles: { fillColor: [236, 177, 118], textColor: [111, 78, 55], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 250, 245] },
    styles: { fontSize: 9 },
  });

  doc.save(`rekap_gaji_${periode}.pdf`);
};

export const exportSlipGajiPDF = (dataList, filename, layout = 1, config = {}, mode = "download") => {
  const doc = new jsPDF("p", "mm", "a4");
  const { logoKop, watermark, namaFinance } = config;

  dataList.forEach((data, index) => {
    // Tentukan posisi awal slip
    const isSecondOnPage = layout === 2 && index % 2 === 1;
    const offsetY = isSecondOnPage ? 148.5 : 0;

    if (index > 0 && index % layout === 0) {
      doc.addPage();
    }

    // --- DRAW SLIP ---
    const margin = 10; // Perkecil margin atas
    const startY = offsetY + margin;

    // 1. Header
    if (logoKop) {
      try {
        const props = doc.getImageProperties(logoKop);
        const ratio = props.width / props.height;
        const maxW = 25;
        const maxH = 12;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) {
          h = maxH;
          w = h * ratio;
        }
        doc.addImage(logoKop, "PNG", margin + 5, startY, w, h);
      } catch (e) { console.error("Logo Kop error", e); }
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("SLIP GAJI", 195 - margin, startY + 4, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${data.periode}`, 195 - margin, startY + 8, { align: "right" });

    // 2. Identitas
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`NAMA ${data.tipe?.toUpperCase()}`, margin + 5, startY + 18);
    doc.text(`ID ${data.tipe?.toUpperCase()}`, 195 - margin - 5, startY + 18, { align: "right" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(data.nama || "................", margin + 5, startY + 23);
    doc.text(data.userId?.toString() || "....", 195 - margin - 5, startY + 23, { align: "right" });

    if (data.tipe === "tetap") {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 102, 204);
      doc.text(`Sisa Cuti: ${data.saldoCuti || 0} Hari`, 195 - margin - 5, startY + 27, { align: "right" });
    }

    // 3. Garis Pemisah
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, startY + 30, 195 - margin - 5, startY + 30);
    doc.setTextColor(0);

    // 4. Watermark
    if (watermark) {
      try {
        doc.saveGraphicsState();
        if (typeof doc.setGState === 'function') {
           const gState = new doc.GState({ opacity: 0.1 });
           doc.setGState(gState);
        }
        const props = doc.getImageProperties(watermark);
        const ratio = props.width / props.height;
        const maxW = 80;
        const maxH = 50;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) { h = maxH; w = h * ratio; }
        doc.addImage(watermark, "PNG", 105 - (w/2), startY + 40, w, h);
        doc.restoreGraphicsState();
      } catch (e) { }
    }

    // 5. Tabel
    const tableY = startY + 38;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("PENDAPATAN", margin + 5, tableY);
    doc.text("POTONGAN", 105, tableY);
    
    doc.setDrawColor(220);
    doc.setLineWidth(0.1);
    doc.line(margin + 5, tableY + 2, 195 - margin - 5, tableY + 2);

    doc.setFont("helvetica", "normal");
    let leftY = tableY + 7;
    let rightY = tableY + 7;

    const drawRow = (label, val, x, y) => {
      doc.text(label, x, y);
      doc.text(`Rp ${(val || 0).toLocaleString("id-ID")}`, 105 - margin - 5, y, { align: "right" });
      return y + 5;
    };
    const drawRowRight = (label, val, x, y) => {
      doc.text(label, x, y);
      doc.text(`Rp ${(val || 0).toLocaleString("id-ID")}`, 195 - margin - 5, y, { align: "right" });
      return y + 5;
    };

    leftY = drawRow("Gaji Pokok", data.gajiPokok || 0, margin + 5, leftY);
    if ((data.upahLembur || 0) > 0) {
      leftY = drawRow("Lembur", data.upahLembur, margin + 5, leftY);
    }
    (data.bonusList || []).forEach(b => {
      leftY = drawRow(b.nama, b.nominal, margin + 5, leftY);
    });

    if (data.tipe === "tetap") {
      rightY = drawRowRight("BPJS", data.potonganBPJSTetap || 0, 105, rightY);
    }
    if ((data.nilaiPotonganIzin || 0) > 0) {
      rightY = drawRowRight(`Izin (${data.totalHariPotonganIzin} hari)`, data.nilaiPotonganIzin, 105, rightY);
    }
    (data.potonganList || []).forEach(p => {
      rightY = drawRowRight(p.nama, p.nominal, 105, rightY);
    });

    const maxColY = Math.max(leftY, rightY, tableY + 30);
    
    // 6. Garis Pemisah Bawah
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, maxColY + 2, 195 - margin - 5, maxColY + 2);

    // 7. Take Home Pay
    const thpY = maxColY + 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TAKE HOME PAY", margin + 5, thpY);
    doc.setFontSize(11);
    doc.text(`Rp ${(data.takeHomePay || 0).toLocaleString("id-ID")}`, 195 - margin - 5, thpY, { align: "right" });
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    const kataTerbilang = terbilang(Math.floor(data.takeHomePay || 0));
    doc.text(`Terbilang: ${kataTerbilang}`, margin + 5, thpY + 4);
    doc.setTextColor(0);

    // 8. Tanda Tangan
    const signY = thpY + 12;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Dibuat Oleh,", margin + 40, signY);
    doc.text("Penerima,", 195 - margin - 40, signY, { align: "right" });
    
    const nameY = signY + 18;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    
    doc.text(namaFinance || "....................", margin + 40, nameY);
    const finW = doc.getTextWidth(namaFinance || "....................");
    doc.line(margin + 40, nameY + 1, margin + 40 + finW, nameY + 1);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Finance", margin + 40, nameY + 4);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(data.nama || "................", 195 - margin - 40, nameY, { align: "right" });
    const empW = doc.getTextWidth(data.nama || "................");
    doc.line(195 - margin - 40 - empW, nameY + 1, 195 - margin - 40, nameY + 1);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(data.tipe === "tetap" ? "Reguler" : "Freelance", 195 - margin - 40, nameY + 4, { align: "right" });

    // 9. Garis Sobekan
    if (layout === 2 && !isSecondOnPage) {
      doc.setLineDashPattern([1, 1], 0);
      doc.setDrawColor(150);
      doc.line(0, 148.5, 210, 148.5);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(12);
      doc.text("✂", 5, 148.5 + 4);
    }
  });

  if (mode === "preview") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(`${filename}.pdf`);
  }
};