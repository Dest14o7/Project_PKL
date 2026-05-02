import * as XLSX from "xlsx";

// Helper untuk format tanggal M/D/YYYY ke YYYY-MM-DD
const parseDate = (val) => {
  if (!val) return null;
  
  // Jika Excel membacanya sebagai Serial Number (number)
  if (typeof val === "number") {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split("T")[0];
  }

  // Jika string M/D/YYYY atau YYYY-MM-DD
  if (typeof val === "string") {
    if (val.includes("/")) {
      const [m, d, y] = val.split("/");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (val.includes("-")) return val; // Sudah format YYYY-MM-DD
  }

  return null;
};

// Konversi nilai waktu ke string "HH:MM"
const formatTime = (val) => {
  if (val === null || val === undefined) return null;
  
  // Format datetime.time dari openpyxl → desimal di XLSX
  if (typeof val === "number") {
    const totalSeconds = Math.round(val * 24 * 60 * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // Format string langsung
  if (typeof val === "string" && val.includes(":")) return val.slice(0, 5);

  return null;
};

// Parse satu sheet
const parseSheet = (ws) => {
  const data = XLSX.utils.sheet_to_json(ws, { 
    header: 1, 
    defval: null,
    raw: true 
  });

  const results = [];
  const offsets = [0, 15, 30]; // 3 karyawan per sheet

  for (const offset of offsets) {
    // Ambil info karyawan
    const dept = data[3]?.[offset + 1] || "";
    const nama = data[3]?.[offset === 0 ? 9 : offset + 8] || 
                 data[3]?.[offset + 9] || "";
    const userId = data[4]?.[offset === 0 ? 9 : offset + 8] || 
                   data[4]?.[offset + 9] || "";

    // Nama ada di kolom berbeda tergantung offset
    const actualNama = (() => {
      if (offset === 0) return data[3]?.[9];
      if (offset === 15) return data[3]?.[24];
      if (offset === 30) return data[3]?.[39];
    })();

    const actualUserId = (() => {
      if (offset === 0) return data[4]?.[9];
      if (offset === 15) return data[4]?.[24];
      if (offset === 30) return data[4]?.[39];
    })();

    const actualDept = data[3]?.[offset + 1] || "";

    if (!actualNama) continue;

    // Ambil data harian mulai row 13 (index 12)
    const dailyData = [];

    for (let r = 12; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;

      const tanggalRaw = row[offset];
      if (!tanggalRaw || typeof tanggalRaw !== "string") continue;

      // Pastikan format "DD NamaHari" misal "02 Sen"
      if (!/^\d{2}\s/.test(tanggalRaw.trim())) continue;

      const tanggal = tanggalRaw.trim();
      const jamMasukPagi    = formatTime(row[offset + 1]);
      const jamKeluarPagi   = formatTime(row[offset + 3]);
      const jamMasukSiang   = formatTime(row[offset + 5]);
      const jamKeluarSiang  = formatTime(row[offset + 7]);
      const jamMasukLembur  = formatTime(row[offset + 10]);
      const jamKeluarLembur = formatTime(row[offset + 12]);

      dailyData.push({
        tanggal,
        jamMasukPagi,
        jamKeluarPagi,
        jamMasukSiang,
        jamKeluarSiang,
        jamMasukLembur,
        jamKeluarLembur,
      });
    }

    results.push({
      nama: actualNama,
      userId: actualUserId,
      dept: actualDept,
      dailyData,
    });
  }

  return results.filter(r => r.nama);
};

// Hitung jam kerja dari jam masuk & keluar
const hitungJamKerja = (masuk, keluar) => {
  if (!masuk || !keluar) return 0;
  const [mH, mM] = masuk.split(":").map(Number);
  const [kH, kM] = keluar.split(":").map(Number);
  const total = (kH * 60 + kM) - (mH * 60 + mM);
  return total > 0 ? total / 60 : 0;
};

// Hitung rekap per karyawan
export const hitungRekap = (dailyData, periode) => {
  let totalJamKerja = 0;
  let totalJamLembur = 0;
  let totalLemburKasar = 0;
  let totalPenguranganLembur = 0;
  let hariHadir = 0;
  let hariTidakHadir = 0;

  for (const day of dailyData) {
    const adaAbsen = day.jamMasukPagi || day.jamKeluarPagi || 
                     day.jamMasukSiang || day.jamKeluarSiang || 
                     day.jamMasukLembur || day.jamKeluarLembur;

    if (adaAbsen) {
      hariHadir++;

      // Hitung jam kerja tiap sesi
      const jamPagi = hitungJamKerja(day.jamMasukPagi, day.jamKeluarPagi);
      const jamSiang = hitungJamKerja(day.jamMasukSiang, day.jamKeluarSiang);
      let jamLembur = hitungJamKerja(day.jamMasukLembur, day.jamKeluarLembur);
      totalLemburKasar += jamLembur;
      let pengurangan = 0;

      // Kurangi lembur berdasarkan keterlambatan (Rule 4.4)
      if (day.jamMasukPagi) {
        const [h, m] = day.jamMasukPagi.split(":").map(Number);
        const menitMasuk = h * 60 + m;
        const batasMasuk = 8 * 60; // 08:00
        if (menitMasuk > batasMasuk) {
          const menitTerlambat = menitMasuk - batasMasuk;
          const jamTerlambat = menitTerlambat / 60;
          if (jamLembur > 0) {
            pengurangan = Math.min(jamLembur, jamTerlambat);
          }
          jamLembur = Math.max(0, jamLembur - jamTerlambat);
        }
      }

      totalPenguranganLembur += pengurangan;
      totalJamKerja += jamPagi + jamSiang + jamLembur;
      totalJamLembur += jamLembur;
    } else {
      hariTidakHadir++;
    }
  }

  return {
    totalJamKerja: Math.round(totalJamKerja * 100) / 100,
    totalJamLembur: Math.round(totalJamLembur * 100) / 100,
    totalLemburKasar: Math.round(totalLemburKasar * 100) / 100,
    totalPenguranganLembur: Math.round(totalPenguranganLembur * 100) / 100,
    hariHadir,
    hariTidakHadir,
  };
};

// Main parser — dipanggil dari halaman Absensi
export const parseAbsensiExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { 
          type: "array", 
          cellDates: false,
          raw: true
        });

        // Ambil periode dari sheet 1
        const ws0 = wb.Sheets[wb.SheetNames[0]];
        const data0 = XLSX.utils.sheet_to_json(ws0, { header: 1, defval: null });
        const periodeRaw = data0[1]?.[0] || "";
        const periode = periodeRaw.replace("Tanggal Statistik:", "").trim();

        // Parse sheet 3 dst (index 2+)
        const allEmployees = [];
        for (let i = 2; i < wb.SheetNames.length; i++) {
          const ws = wb.Sheets[wb.SheetNames[i]];
          const employees = parseSheet(ws);
          allEmployees.push(...employees);
        }

        // Tambahkan rekap ke tiap karyawan
        const result = allEmployees.map(emp => ({
          ...emp,
          rekap: hitungRekap(emp.dailyData, periode),
          anomali: deteksiAnomali(emp.dailyData, periode),
          periode,
        }));

        resolve({ employees: result, periode });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Deteksi anomali per hari
export const deteksiAnomali = (dailyData, periode, sabtuFullTime = false) => {
  const anomali = [];

  for (const day of dailyData) {
    const tanggalLengkap = parseTanggalLengkap(day.tanggal, periode);
    if (!tanggalLengkap) continue;

    const date = new Date(tanggalLengkap);
    const dayOfWeek = date.getDay(); // 0=Min, 6=Sab

    // Skip Minggu
    if (dayOfWeek === 0) continue;

    const isSabtu = dayOfWeek === 6;
    const jamSelesai = isSabtu && !sabtuFullTime ? "12:00" : "16:00";

    const adaAbsen = day.jamMasukPagi || day.jamKeluarPagi || 
                     day.jamMasukSiang || day.jamKeluarSiang || 
                     day.jamMasukLembur || day.jamKeluarLembur;

    // Tidak hadir
    if (!adaAbsen) {
      anomali.push({
        tanggal: tanggalLengkap,
        tanggalLabel: day.tanggal,
        jenis: "Tidak Hadir",
        keterangan: "Tidak ada scan di hari kerja",
        status: "belum",
      });
      continue;
    }

    // Terlambat
    if (day.jamMasukPagi) {
      const [h, m] = day.jamMasukPagi.split(":").map(Number);
      const menitMasuk = h * 60 + m;
      const batasTerlambat = 8 * 60 + 10; // 08:10
      if (menitMasuk > batasTerlambat) {
        anomali.push({
          tanggal: tanggalLengkap,
          tanggalLabel: day.tanggal,
          jenis: "Terlambat",
          keterangan: `Masuk jam ${day.jamMasukPagi} (batas 08:10)`,
          status: "dikonfirmasi", // Auto-confirmed, just for stats
        });
      }
    }

    // Scan tidak lengkap
const hanyaMasuk = day.jamMasukPagi && !day.jamKeluarPagi;
const hanyaKeluar = !day.jamMasukPagi && day.jamKeluarPagi;

if (hanyaMasuk || hanyaKeluar) {
  anomali.push({
    tanggal: tanggalLengkap,
    tanggalLabel: day.tanggal,
    jenis: "Scan Tidak Lengkap",
    keterangan: hanyaMasuk
      ? `Hanya ada scan masuk (${day.jamMasukPagi}), tidak ada scan keluar`
      : `Hanya ada scan keluar (${day.jamKeluarPagi}), tidak ada scan masuk`,
    status: "belum",
  });
}
  }

  return anomali;
};

// Parse tanggal lengkap dari "DD NamaHari" + periode
export const parseTanggalLengkap = (tanggalRow, periode) => {
  if (!tanggalRow || !periode) return null;
  const [start] = periode.split("~");
  // Robust date extraction (matches YYYY/MM/DD, DD-MM-YYYY, etc.)
  const parts = start.trim().split(/[-/]/);
  let y, m, d;

  if (parts[0].length === 4) {
    // YYYY-MM-DD
    [y, m, d] = parts;
  } else if (parts[2].length === 4) {
    // DD-MM-YYYY
    [d, m, y] = parts;
  } else {
    // Fallback default
    [y, m, d] = parts;
  }

  const tgl = tanggalRow.split(" ")[0];
  return `${y}-${m.padStart(2, "0")}-${tgl.padStart(2, "0")}`;
};

// Parser untuk Data Izin (Bulk)
export const parseIzinExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        // Mulai dari baris 2 (index 1) karena baris 1 header
        const results = [];
        const validTypes = ["izin", "cuti", "sakit", "setengah hari (siang)", "setengah hari (pagi)"];

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const userIdRaw = row[1];
          const nama = row[2] || "";
          const jenisRaw = row[3]?.toString()?.toLowerCase()?.trim() || "";
          const tglMulai = parseDate(row[4]);
          const tglSelesai = (row[5] === "-" || !row[5]) ? tglMulai : parseDate(row[5]);
          const jamMulai = row[6] === "-" ? null : formatTime(row[6]);
          const jamSelesai = row[7] === "-" ? null : formatTime(row[7]);
          const totalHari = parseFloat(row[8]) || 0;
          const keterangan = row[9] || "";

          const userId = userIdRaw?.toString()?.replace(/^0+/, "") || "";
          if (!userId) continue;

          // Validasi tipe
          const isValidType = validTypes.includes(jenisRaw);
          const errors = [];
          if (!isValidType) errors.push(`Jenis izin '${row[3]}' tidak valid`);
          if (!tglMulai) errors.push("Tanggal mulai tidak valid");
          if (totalHari <= 0) errors.push("Total hari harus lebih dari 0");

          results.push({
            userId,
            nama,
            jenis: row[3] || "Izin", // Simpan label aslinya
            tanggal: tglMulai,
            tglMulai,
            tglSelesai,
            jamMulai,
            jamSelesai,
            totalHari,
            keterangan,
            errors,
            isValid: errors.length === 0
          });
        }
        resolve(results);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};