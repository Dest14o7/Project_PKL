import ExcelJS from "exceljs";

export const exportRekapAbsen = async (absensiData) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rekap Absensi");

  // Sort by userId
  const sorted = [...absensiData].sort((a, b) => Number(a.userId) - Number(b.userId));

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

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rekap_absen_${new Date().toISOString().slice(0, 7)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};