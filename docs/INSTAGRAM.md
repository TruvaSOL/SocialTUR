# Instagram: yoruma otomatik bilet

Amaç: gönderinin altına "stadyum" yazan kişiye, içinde bilet kodu hazır bir bağlantı kendiliğinden gitsin. Kişi bağlantıya dokunur, karakterini yapar, koltuğuna geçer. Kod yazmaz; sen elle bir şey göndermezsin.

Ücretli bir mesaj aracı kullanmıyoruz (karar #48): kendi Meta uygulamamız ve Supabase'deki küçük bir fonksiyon bu işi yapıyor.

## Nasıl çalışıyor

1. Biri gönderine yorum yazar.
2. Meta bu yorumu bizim adrese bildirir: `https://ncbmkepmvbkofcpajadc.supabase.co/functions/v1/instagram-webhook`
3. Fonksiyon bildirimin gerçekten Meta'dan geldiğini imzadan anlar, veritabanına sorar:
   - Yorumda anahtar kelime var mı (`settings` → `ig_keywords`: "stadyum", "stadium")?
   - Bu yoruma daha önce cevap verildi mi? (Meta yorum başına tek mesaja izin verir; aynı bildirim iki kez gelirse ikinci mesaj gitmez.)
   - Bu kişinin bileti var mı? Yoksa yeni bilet üretilir (`issue_ticket`).
4. Fonksiyon yoruma özel mesajla cevap verir. Metinler `settings` tablosunda, kod değiştirmeden düzenlenebilir:
   - `ig_reply_new`: yeni bilet ({url} yerine bağlantı gelir)
   - `ig_reply_used`: zaten stadyumda olan kişi
   - `ig_reply_full`: stadyum dolu
5. Her yorumun sonucu `ig_comments` tablosunda durur: `sent` (gitti), `skipped` (anahtar kelime yok), `failed` (gitmedi, `error` sütununda nedeni).

Parçalar: `supabase/migrations/0004_instagram_webhook.sql` ve `supabase/functions/instagram-webhook/index.ts`.

## Gizli değerler

Hepsi Supabase → Table Editor → `private_config` tablosunda durur; hiçbiri sohbete ya da depoya yazılmaz.

| Satır | Ne | Nereden |
|---|---|---|
| `ig_verify_token` | Meta'nın adresimizi doğrulaması için parola | Veritabanında üretildi. Buradan kopyalayıp Meta panelindeki "Verify token" alanına yapıştırırsın. |
| `ig_app_secret` | Bildirimlerin Meta'dan geldiğini kanıtlayan anahtar | Meta panelinden kopyalayıp buraya yapıştırırsın. |
| `ig_token` | Mesaj gönderme izni | Meta panelinde "Generate token" ile üretip buraya yapıştırırsın. 60 gün geçerli; fonksiyon her 7 günde kendisi yeniler. |

## Kurulum: Meta uygulaması (senin adımların)

Menü adları değişebilir; mantık aynıdır. Takıldığın ekranın görüntüsünü at, birlikte geçeriz.

1. **Instagram hesabı** işletme ya da içerik üretici hesabı olmalı (Ayarlar → Hesap türü; ücretsiz). Facebook sayfası gerekmez.
2. **developers.facebook.com**'da geliştirici hesabı aç (Facebook hesabınla giriş).
3. **Uygulama oluştur** → kullanım amacı olarak Instagram'ı seç ("Instagram API" / "Instagram ile giriş").
4. Uygulamada **Instagram → API setup with Instagram login**:
   - "Generate access tokens" kısmında kendi Instagram hesabını ekle ve token üret → `private_config` → `ig_token` satırına yapıştır.
   - Aynı sayfadaki **Instagram app secret**'ı kopyala → `ig_app_secret` satırına yapıştır.
   - **Webhooks**: Callback URL olarak yukarıdaki adresi, Verify token olarak `ig_verify_token` değerini gir → "Verify and save". Sonra **comments** alanına abone ol.
5. İzinler: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`.
6. **Deneme**: uygulama geliştirme aşamasındayken yalnızca uygulamada rolü olan hesaplar çalışır. İkinci bir Instagram hesabını uygulamaya "Instagram Tester" olarak ekle, o hesapla gönderine "stadyum" yaz, mesaj geliyor mu bak.
7. **Herkese açmak**: uygulamayı "Live" yap, yukarıdaki izinler için **Advanced Access** iste (App Review), ve **Business Verification** (işletme doğrulaması) yap. Meta incelemesi günler ya da haftalar sürebilir; bir ekran kaydı ve gizlilik politikası adresi ister.

## Kurulum: Supabase (benim adımlarım, sen giriş yapınca)

1. `0004_instagram_webhook.sql`'i SQL Editor'da çalıştır, geri alınan denemeyle sına.
2. Edge Functions → yeni fonksiyon `instagram-webhook`, kodu yapıştır, **"Verify JWT" kapalı** (Meta Supabase girişi göndermez; kimliği imzadan anlıyoruz).

## Meta'nın sınırları

- Yorum başına tek özel mesaj; kişi cevap yazmazsa ikinci mesaj atılamaz.
- Mesaj yorumdan sonraki 7 gün içinde gönderilebilir.
- Hesap başına saatte en çok 750 özel yanıt. Çok hızlı yayılırsa bazı mesajlar gecikir ya da gitmez (`ig_comments`'te `failed` görünür).
- Seni takip etmeyen kişiye giden mesaj "İstekler" klasörüne düşer.
- Bir kişinin seni takip edip etmediği sorgulanamaz; yorum yazan herkes bilet alır.

## Koltuk ve Instagram adı

Bilet bir Instagram hesabı için üretildiğinden, kişi koltuğa geçtiğinde Instagram kullanıcı adı profiline kaydedilir. Bu ad şimdilik hiçbir yerde gösterilmez; yalnızca veritabanında durur.

## Elle bilet ucu (yedek)

`issue_ticket` hâlâ dışarıdan çağrılabilir (`/rest/v1/rpc/issue_ticket`, gizli anahtar `private_config` → `ticket_issuer`). Başka bir araçla bilet dağıtmak gerekirse kullanılır.
