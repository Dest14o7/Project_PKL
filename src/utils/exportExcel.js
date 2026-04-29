import ExcelJS from "exceljs";

export const exportRekapAbsen = async (absensiData, selectedPeriode) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rekap Absensi");

  // Sort by userId ascending
  const sorted = [...absensiData].sort((a, b) => {
    const idA = Number(a.userId) || 0;
    const idB = Number(b.userId) || 0;
    return idA - idB;
  });

  for (const emp of sorted) {
    for (const day of emp.dailyData) {
      sheet.addRow([
        day.tanggal,
        emp.nama,
        day.jamMasukPagi || "",
        day.jamKeluarPagi || "",
      ]);
    }
  }

  // Filename: rekap_absen_[bulan]_[tahun]_karyawan.xlsx
  const fileNamePart = (selectedPeriode || "export").toLowerCase().replace(/\s+/g, "_");
  const fileName = `rekap_absen_${fileNamePart}_karyawan.xlsx`;

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadTemplateIzin = async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template Izin");

  // Headers
  sheet.addRow([
    "no", "user id", "nama", "jenis izin", 
    "tgl mulai", "tgl selesai", "jam mulai", "jam selesai", 
    "total hari", "ket"
  ]);
  sheet.getRow(1).font = { bold: true };

  // Sample data
  sheet.addRow([1, "1", "Budi Santoso", "Izin", "2/8/2026", "-", "-", "-", 1, "Acara keluarga"]);
  sheet.addRow([2, "2", "Ani Wijaya", "Setengah Hari (Siang)", "2/9/2026", "-", "12:00", "16:00", 0.5, "Kebutuhan mendesak"]);
  sheet.addRow([3, "3", "Cahyo", "Sakit", "2/10/2026", "2/12/2026", "-", "-", 3, "Demam tinggi"]);

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template_import_izin.xlsx";
  a.click();
  URL.revokeObjectURL(url);
};