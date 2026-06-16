/**
 * Sunset Social Hub - Defensive Security Module
 * Berbasis Object-Oriented Standar Industri Cyber Security
 */
class SecurityEngine {
    constructor() {
        this.allowedAudioExtensions = /(\.mp3|\.ogg|\.wav|\.m4a)$/i;
    }

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

    validateAudioURL(url) {
        if (!url) return { valid: false, error: "Kolom input kosong." };
        if (!url.startsWith("https://")) {
            return { valid: false, error: "Koneksi tidak aman! URL wajib menggunakan HTTPS://." };
        }
        if (!this.allowedAudioExtensions.test(url)) {
            return { valid: false, error: "Ekstensi file dilarang! Hanya menerima format .mp3, .ogg, .wav" };
        }
        return { valid: true, error: null };
    }
}

const Security = new SecurityEngine();