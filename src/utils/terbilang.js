export const terbilang = (angka) => {
  if (angka === 0) return "nol rupiah";

  const satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  
  const hitung = (n) => {
    if (n < 12) return satuan[n];
    if (n < 20) return satuan[n - 10] + " belas";
    if (n < 100) return satuan[Math.floor(n / 10)] + " puluh " + satuan[n % 10];
    if (n < 200) return "seratus " + hitung(n - 100);
    if (n < 1000) return satuan[Math.floor(n / 100)] + " ratus " + hitung(n % 100);
    if (n < 2000) return "seribu " + hitung(n - 1000);
    if (n < 1000000) return hitung(Math.floor(n / 1000)) + " ribu " + hitung(n % 1000);
    if (n < 1000000000) return hitung(Math.floor(n / 1000000)) + " juta " + hitung(n % 1000000);
    if (n < 1000000000000) return hitung(Math.floor(n / 1000000000)) + " miliar " + hitung(n % 1000000000);
    return "";
  };

  const hasil = hitung(Math.floor(Math.abs(angka)));
  let bersih = hasil.replace(/\s+/g, ' ').trim();
  
  if (angka < 0) return "minus " + bersih + " rupiah";
  return bersih + " rupiah";
};
