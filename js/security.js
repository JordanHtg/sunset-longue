/**
 * Sunset Social Hub - Defensive Security Module
 * Berbasis Object-Oriented Standar Industri Cyber Security
 */
class SecurityEngine {
    constructor() {
        // Hanya mengizinkan file audio murni demi mencegah eksekusi malware (.exe/.bat) berkedok audio
        this.allowedAudioExtensions = /(\.mp3|\.ogg|\.wav|\.m4a)$/i;
    }

    /**
     * Sanitasi Teks (Anti XSS / Cross-Site Scripting Injection)
     * Mengubah karakter html sensitif menjadi entity aman agar kode peretas tidak bisa berjalan
     */
    sanitizeHTML(rawString) {
        if (!rawString) return "";
        return rawString
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;")
            .replace(/\//g, "&#x2F;");
    }

    /**
     * Validasi URL Audio (Anti Malicious Link / Phishing)
     * Memastikan link menggunakan SSL (HTTPS) dan murni berekstensi suara
     */
    validateAudioURL(url) {
        if (!url) return { valid: false, error: "Kolom input kosong." };

        // 1. Wajib HTTPS (Mencegah Man-in-the-Middle Sniffing)
        if (!url.startsWith("https://")) {
            return { valid: false, error: "Koneksi tidak aman! URL wajib menggunakan HTTPS://." };
        }

        // 2. Skrining Ekstensi File
        if (!this.allowedAudioExtensions.test(url)) {
            return { valid: false, error: "Ekstensi file dilarang! Hanya menerima format .mp3, .ogg, .wav" };
        }

        return { valid: true, error: null };
    }
}

// Inisialisasi secara global agar bisa dipanggil oleh modul utama game
const Security = new SecurityEngine();