# Senden istediklerim: hesaplar

Hesapları sen açarsın; şifreleri ve gizli anahtarları bana yazma, sohbete yapıştırma. Aşağıda hangisinin ne zaman gerektiği ve benimle neyi paylaşacağın yazıyor.

## Aşama 1 için (telefonda görebilmen için)

### 1. GitHub — kodun durduğu yer
1. https://github.com adresinde hesap aç (varsa atla).
2. Boş bir depo oluştur. Gizli (private) olabilir. Adı şimdilik fark etmez; oyunun adı kesinleşince değiştirilebilir.
3. Bu bilgisayarda GitHub'a giriş yapılmış olmalı; nasıl yapılacağını o an adım adım göstereceğim.
4. Bana yalnızca depo adresini söyle.

### 2. Cloudflare — oyunun yayınlandığı yer (karar #9, onayını bekliyor)
1. https://dash.cloudflare.com adresinde ücretsiz hesap aç.
2. "Workers & Pages" bölümünden GitHub deposunu bağla; ayarları birlikte gireriz.
3. Sonuç: `proje-adi.pages.dev` biçiminde, telefonundan açacağın ücretsiz bir adres.

Ücretsiz planın okunan sınırları (2026-11-14): ayda 500 yayın, proje başına 100 özel alan adı, sınırsız deneme adresi. Bant genişliği sınırı sayfada belirtilmiyor.

## Aşama 3 için (hesap ve giriş)

### 3. Supabase — sunucu ve veritabanı
1. https://supabase.com adresinde hesap aç, yeni proje oluştur. Bölge: oyuncuların çoğu Türkiye'deyse Frankfurt.
2. Project Settings → API sayfasındaki **Project URL** ve **anon public** anahtarını `.env` dosyasına sen yazarsın (yerini göstereceğim).
3. **service_role** anahtarını hiçbir yere yapıştırma.

Planların okunan sınırları (2026-11-14):

| | Ücretsiz | Pro (aylık yaklaşık 25 dolar) |
|---|---|---|
| Aynı anda bağlı oyuncu | 200 | 500 (harcama sınırı kaldırılırsa 10.000) |
| Saniyede canlı mesaj | 100 | 500 |
| Veritabanı | 500 MB | 8 GB |
| Kullanılmayınca | 1 hafta sonra duraklatılır | duraklatılmaz |

Geliştirme ücretsiz planla yapılır. Oyun doğrudan herkese açılacağı için (karar #1) açılıştan önce Pro plana geçmek gerekir.

### 4. Google ile giriş
Google Cloud Console'da bir "OAuth istemcisi" oluşturulur ve Supabase'e bağlanır. Ücretsizdir; adımlarını Aşama 3'te ekran ekran yazacağım.

## Sonra

- **Alan adı:** ad kesinleşince alınır ve Cloudflare'e bağlanır (karar #7).
- **E-posta gönderimi:** kayıt onay e-postaları için açılıştan önce bir gönderim hizmeti gerekecek; Aşama 3'te seçenekleri getireceğim.
- **Higgsfield:** hesabın zaten bağlı; her üretim kredi harcadığı için önce soracağım.
