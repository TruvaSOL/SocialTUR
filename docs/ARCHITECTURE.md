> **Not (2026-11-17):** Bu belge şehir oyunu için yazıldı. Oyun stadyuma dönüştü (karar #34). Güncel veri modeli: `supabase/migrations/0002_stadium.sql`; güncel yapı: `src/stadium/`.

# Mimari özeti

Sade anlatım: oyun üç parçadan oluşur.

1. **Telefondaki oyun (istemci).** Şehri çizer, dokunuşları alır, panelleri gösterir. Hiçbir kazancı kendisi hesaplamaz; sunucuya yalnızca istek gönderir: "şu işi başlat", "topla", "katkı ver".
2. **Sunucu (Supabase).** Hesaplar, veritabanı ve oyunun bütün kuralları burada. Coin, envanter, iş süreleri ve inşa katkıları sunucunun saatine göre burada hesaplanır.
3. **Yayın (barındırma).** Oyunun dosyalarını telefona ulaştıran yer. Kod GitHub'da durur; ana dala her güncelleme otomatik yayınlanır.

```
Telefon (tarayıcı)                     Supabase
┌───────────────────────────┐          ┌──────────────────────────────┐
│ 3D sahne (Three.js)       │  istek   │ Kural fonksiyonları          │
│ Arayüz (HTML/CSS)         │ ───────► │  start_job / collect_job     │
│ Dil dosyaları (TR, EN)    │          │  contribute / place_item ... │
│ Ölçüm katmanı (geliştirme)│ ◄─────── │ Veritabanı + satır güvenliği │
└───────────────────────────┘  sonuç,  │ Hesaplar (e-posta, Google)   │
        ▲                      canlı   │ Canlı kanal (sohbet, bildirim)│
        │ dosyalar             olaylar └──────────────────────────────┘
┌───────────────────────────┐
│ Barındırma (Cloudflare    │  ◄── GitHub ana dalı (otomatik yayın)
│ Pages, öneri)             │
└───────────────────────────┘
```

## İstemci

- **Dil ve araçlar:** TypeScript, Vite, Three.js. Arayüz tuvalin üstünde düz HTML/CSS; arayüz çatısı yok.
- **Klasör düzeni (Aşama 1'de kurulacak):**
  - `src/engine/` sahne, kamera, ışık, kalite ayarı, ölçüm katmanı
  - `src/world/` mahalle, binalar, kalabalık (karakter) sistemi
  - `src/ui/` paneller, editörler, sohbet
  - `src/net/` sunucuyla konuşan tek katman (başka hiçbir yer sunucuya doğrudan gitmez)
  - `src/i18n/` dil dosyaları; koda metin gömülmez
  - `src/config/` oyunun adı gibi değişebilecek sabitler
  - `assets-src/` ham modeller, `public/assets/` oyuna hazır çıktılar
  - `tools/` varlık hattı ve ekonomi simülasyonu
  - `supabase/` veritabanı şeması, kural fonksiyonları, testleri
- **Çizim:** her telefonda çalışan WebGL2. Tekrarlayan her şey tek çizim çağrısında toplanır.
- **Kalabalık:** yakındaki sınırlı sayıda karakter gerçek iskeletle, uzaktakiler önceden kaydedilmiş hareketle ve toplu çizilir (bkz. `PERF_BUDGET.md`).
- **Mahalle yükleme:** şehir karelere bölünür; yaklaşılan mahalle yüklenir, uzaklaşılan bırakılır. Betada tek mahalle olsa da sistem baştan bu şekilde kurulur.
- **Uygulamaya sarma:** çıktı sıradan statik web dosyalarıdır; Capacitor ile sonradan sarılabilir. Bunu engelleyecek tek şey tarayıcıya özgü giriş akışlarıdır; Google girişi yönlendirme adresi ayardan gelecek şekilde yazılır.

## Sunucu

- **Kurallar veritabanı fonksiyonlarında.** İstemci tablolara doğrudan yazamaz; yalnızca fonksiyon çağırır. Her fonksiyon kimin çağırdığını kendisi belirler, süreleri kendi saatinden okur, ödülü ayar tablolarından alır.
- **Ayar tabloları.** İş süreleri, ödüller, fiyatlar, inşa hedefleri veritabanında durur; yeni yayın yapmadan değiştirilir.
- **Coin defteri.** Her coin hareketi silinmeyen bir deftere satır olarak yazılır (kim, ne kadar, neden). Bakiye bu defterden doğrulanabilir; hata ve hile sonradan izlenebilir.
- **Satır düzeyi güvenlik.** Oyuncu yalnızca kendi özel verisini okur; herkese açık olanlar (profil kartı, ev, liman ilerlemesi) ayrı görünümlerden sunulur.
- **Edge function yalnızca gereken yerde:** hesap silme ve veri dışa aktarma, paylaşım görseli, zamanlanmış işler.

## Diğer oyuncuları görmek

Sürekli konum yayını yok. Sunucu her oyuncu için küçük bir durum satırı tutar: nerede, ne yapıyor, ne zamandan beri, nereye gidiyor. Telefon bu satırları aralıklarla alır ve yürüyüşü kendisi canlandırır. Aynı bilgiyi alan iki telefon aynı sahneyi görür.

- Çalışan ya da AFK karakterler: durum yalnızca değiştiğinde güncellenir.
- Göz hizasında yürüyen oyuncu: birkaç saniyede bir konum bildirir; diğer telefonlar arayı yumuşatır.
- Sohbet, bildirim, varış duyurusu, liman ilerlemesi: canlı kanaldan anında.

## Yayın

- Öneri: Cloudflare Pages (karar #9). Ana dal → canlı adres; diğer dallar → deneme adresi.
- Gizli anahtarlar depoda durmaz. İstemcinin kullandığı Supabase adresi ve açık anahtarı gizli değildir ama yine de `.env` dosyasından gelir; gizli olan servis anahtarı yalnızca Supabase ve barındırma panellerinde durur.

## Test ve doğrulama

- Ekonomi kuralları için otomatik testler ve simülasyon (Aşama 4).
- Her yayında boyut denetimi: ilk yükleme 6 MB'ı aşarsa yayın durur.
- Ölçüm katmanı geliştirme sürümünde her zaman açılabilir: fps, çizim çağrısı, üçgen, bellek, indirilen boyut.
