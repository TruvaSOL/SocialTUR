# Instagram: yoruma "TRİBÜN" → kişiye özel bilet DM'i

Durum (2026-11-18): **kurulu ve uçtan uca sınandı, güvenli modda.** Kararlar #48, #50.

Biri hedef Reel'in altına **TRİBÜN** yazar → Meta yorumu bize bildirir → kişiye kendi bilet kodunu taşıyan bağlantı tek bir özel yanıtla (DM) gider → kişi bağlantıya dokunur, karakterini yapar, koltuğuna geçer.

## Parçalar

| Parça | Nerede |
|---|---|
| Meta uygulaması | developers.facebook.com → **Garip Futbol Stadyumu** (App ID 1923268258638001), işletme portföyü **Garip Futbol Anları**. Kullanım durumu: *Manage messaging & content on Instagram*, yöntem **Unified login** (Meta yeni uygulamalarda "Instagram login"i kaldırdı). |
| Bağlı hesap | **@garipfutbolanlari**, Instagram hesap numarası `17841455045530273` |
| Webhook | `https://ncbmkepmvbkofcpajadc.supabase.co/functions/v1/instagram-webhook`, alan: **comments** (v27.0) |
| Sunucu | Supabase Edge Function `instagram-webhook` (JWT doğrulaması kapalı; her istek Meta imzasıyla doğrulanır) |
| Veritabanı | `supabase/migrations/0004_instagram_webhook.sql`: `ig_comments` (yorum günlüğü), `ig_handle_comment()`, `ig_comment_done()` |
| Kod / sınama | `supabase/functions/instagram-webhook/index.ts`, `test.mjs` (`node supabase/functions/instagram-webhook/test.mjs`) |

## Anahtarlar ve ayarlar

**Gizli değerler** — Supabase → Table Editor → `private_config` (sohbete, depoya, kayıtlara yazılmaz):

| Satır | Ne | Nereden |
|---|---|---|
| `ig_verify_token` | Meta'nın adresimizi doğrulaması | Veritabanında üretildi; Meta → Use cases → Customize → *3. Configure webhooks* → Verify token |
| `ig_app_secret` | Bildirimin Meta'dan geldiğinin kanıtı | Meta → App settings → Basic → App secret |
| `ig_token` | DM gönderme anahtarı (system user, **süresi dolmaz**) | Meta → *2. Generate access tokens* → Generate token |

**Anahtarlar (switch)** — Supabase → `settings` tablosu, kod değiştirmeden:

| Satır | Şu an | Anlamı |
|---|---|---|
| `ig_live` | `false` | **Güvenli mod**: yorumlar kaydedilir, mesaj gitmez, bilet üretilmez. `true` = canlı. |
| `ig_account_id` | `"17841455045530273"` | Yalnız bu hesabın gönderileri |
| `ig_target_media` | `"17866526121692563"` (eski bir test gönderisi) | Yalnız bu gönderiye gelen yorumlar. Reel paylaşılınca onun numarası yazılacak. |
| `ig_keywords` | `["tribun"]` | Türkçe harf ve büyük/küçük farkı gözetmeden, tam kelime: TRİBÜN, tribün, Tribün! evet; tribünlü hayır |
| `ig_reply_new` / `ig_reply_used` / `ig_reply_full` | metinler | DM metinleri; `{url}` kişinin bilet bağlantısı olur |
| `ig_token_refresh_days` | `0` | System-user anahtarı yenileme istemez |

Fonksiyonun durumu (değerleri göstermeden): `…/functions/v1/instagram-webhook?health`

## Kurallar

- Yalnız ana yorumlar (yanıt yorumları sayılmaz); kendi yorumlarımıza cevap verilmez.
- Yorum başına **tek deneme**: aynı bildirim iki kez gelse de, gönderim başarısız olsa da ikinci mesaj gitmez. Güvenli modda görülen yorum, canlıya geçince de cevaplanmaz.
- Aynı kişi yeniden yorum yazarsa aynı bilet bağlantısı gider; koltuğa geçmişse "zaten tribündesin" metni.
- Meta'nın hata gövdesi saklanmaz (kişisel veri olabilir), yalnız durum ve hata kodu.
- Meta sınırları: yorum başına tek özel yanıt, yorumdan sonra 7 gün içinde; takip etmeyenlere giden mesaj "İstekler"e düşer; takip durumu sorgulanamaz.

## Sınama sonuçları (2026-11-18)

- Yerel: 30/30 (anahtar kelime, imza, filtreler, güvenli mod, tek deneme, hata kaydı).
- Veritabanı: 12/12 (geri alınan sınama).
- Dışarıdan: yanlış doğrulama 403, imzasız/sahte imza 401, yorum günlüğü ve fonksiyonlar herkese kapalı.
- Meta'nın test bildirimi: 200 (imza doğru).
- **Uçtan uca**: ikinci hesabın gerçek TRİBÜN yorumu → güvenli modda kaydedildi; canlı modda yeni yorum → DM gitti (`sent`) → bağlantıdan bilet `A8Z5-GRD5` alındı, koltuk 1 (taraftar #1). Sonra güvenli moda dönüldü.

## Yayına almak için kalanlar

1. **Meta onayı (zorunlu):** Uygulama geliştirme modunda; DM yalnızca uygulamada rolü olan hesaplara (Instagram Tester) gider. Herkese açmak için: uygulamayı **Live** yapmak, `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages` için **App Review (Advanced Access)** ve **İşletme doğrulaması** (Garip Futbol Anları portföyü). App Review gizlilik politikası adresi ve ekran kaydı ister.
2. **Reel'i hedeflemek:** Reel paylaşılınca `ig_target_media`'yı boşaltıp güvenli modda ikinci hesapla Reel'e TRİBÜN yazılır, `ig_comments`'te görünen `media_id` hedef olarak yazılır, sonra `ig_live = true`.
3. **Site adı:** DM bağlantısı `socialtur.pages.dev`'e gider; site henüz "Sociativeworld" adını gösteriyor (video ve DM "Garip Futbol Stadyumu" diyor).
4. Test bileti `A8Z5-GRD5` ve taraftar #1 gerçek kayıttır; istenirse silinir.

## Elle bilet ucu (yedek)

`issue_ticket` dışarıdan da çağrılabilir (`/rest/v1/rpc/issue_ticket`, gizli anahtar `private_config` → `ticket_issuer`).
