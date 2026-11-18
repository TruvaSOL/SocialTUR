# Meta App Review başvurusu — Garip Futbol Stadyumu

Uygulama: **Garip Futbol Stadyumu** (App ID 1923268258638001) · İşletme: **Garip Futbol Anları**

Amaç: "TRİBÜN" otomasyonunun yalnız test hesaplarına değil, Reel'e yorum yazan herkese çalışması. Bunun için üç izinde **Advanced Access** gerekiyor; Meta ayrıca **işletme doğrulaması** istiyor.

## Hazır olanlar

| | Durum |
|---|---|
| Gizlilik politikası | ✅ https://socialtur.pages.dev/gizlilik (Türkçe + İngilizce) — Meta'ya girildi |
| Veri silme talimatları | ✅ https://socialtur.pages.dev/veri-silme — Meta'ya girildi |
| Kategori | ✅ Entertainment |
| Uygulama simgesi | ⏳ `ad-out/meta_app_icon_1024.png` hazır; App settings → Basic → *App icon* alanına **sürükle-bırak** (sahip) |
| Son 30 günde başarılı API çağrısı | ✅ `instagram_manage_messages` (DM denemesi), `instagram_basic` ve `instagram_manage_comments` (`?probe` kontrolü, 18.11.2026). Meta sayaçları ~24 saatte güncelleniyor. |
| Uçtan uca çalışan akış | ✅ yorum → DM → bilet → koltuk (bkz. `INSTAGRAM.md`) |

## Sahibin yapacakları (sırayla)

1. **Simge:** App settings → Basic → App icon kutusuna `meta_app_icon_1024.png` dosyasını sürükle, **Save Changes**.
2. **İşletme doğrulaması:** business.facebook.com → İşletme ayarları → **Güvenlik Merkezi** → *Doğrulamayı başlat*. Şirket adı, adres, telefon ve belge (vergi levhası / ticaret sicili / faaliyet belgesi) ister. Meta'nın kararı birkaç gün sürebilir. Belgeler sende olduğundan bu adım tamamen sende.
3. **Ekran kaydı:** aşağıdaki senaryoyla telefondan bir kayıt (1–2 dakika).
4. **Başvuru:** Use cases → Instagram API → *Permissions and features* → `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages` için **Request advanced access** → aşağıdaki açıklamaları yapıştır, ekran kaydını yükle → **Submit for review**. (Meta formun yerini değiştirebilir; App Review → Requests sayfası da olabilir.) Gönder düğmesine sen basarsın.
5. Onay gelince: uygulamayı **Live** yap (Publish), Reel'in numarasını hedefe yaz, `ig_live = true`.

## Başvuru metinleri (İngilizce — Meta'nın inceleme ekibi için)

### instagram_manage_comments

> Garip Futbol Anları runs a virtual football stadium website (https://socialtur.pages.dev). We announce it on our own Instagram professional account @garipfutbolanlari with a Reel that invites people to comment the word "TRİBÜN" to get a free stadium ticket.
>
> We use instagram_manage_comments only to receive the comments webhook for that one Reel of our own account. Our server checks that the comment is a top-level comment on the target Reel and contains the word "TRİBÜN". We store only the comment ID, media ID, the commenter's app-scoped user ID and username; we do not store the comment text. Each comment is handled at most once. We never read comments on other accounts, never moderate, hide or delete comments, and never collect follower lists.

### instagram_manage_messages

> When someone comments "TRİBÜN" on our Reel, we send exactly one private reply to that comment (POST /{ig-user-id}/messages with recipient.comment_id), within Instagram's 7-day private reply window. The message contains a personal ticket link to our website, where the person creates a stadium character and takes a seat. We send no other messages, no follow-ups and no marketing. If the same person comments again, the same ticket link is reused; nothing else is sent.

### instagram_basic

> We use instagram_basic to read our own Instagram professional account's ID and username (and the media ID of our Reel) so the server only reacts to comments on our own account's target post. No data about other accounts is read.

### Ekran kaydı için açıklama (isteğe bağlı not)

> The screencast shows: (1) a test user commenting "TRİBÜN" on our Reel, (2) the private reply arriving in the user's Instagram inbox with a ticket link, (3) opening the link, creating a character and taking a seat on our website, (4) our App Dashboard webhook settings (comments field subscribed) for app transparency.

## Ekran kaydı senaryosu (telefon, 1–2 dk)

Meta, iznin **nasıl kullanıldığını** görmek istiyor. Yalnız test hesabıyla (ikinci hesabın) ve canlı modda çekilir; çekimden önce bana söyle, kısa süreliğine `ig_live`'ı açarım ve hedef gönderiyi ayarlarım.

1. **(0–15 sn)** İkinci hesapla @garipfutbolanlari profiline gir, hedef gönderiyi aç.
2. **(15–30 sn)** Yorumlara **TRİBÜN** yaz, gönder.
3. **(30–50 sn)** Instagram mesajlarına (gerekirse **İstekler**'e) geç; gelen DM'yi göster: "Garip Futbol Stadyumu'na hoş geldin! … Biletini almak için: https://socialtur.pages.dev/?kod=…"
4. **(50–90 sn)** Bağlantıya dokun; site açılır, bilet kodu dolu gelir; yaş seçimi ve karakter oluşturma; **Koltuğumu al**; koltuktan stadyum görünümü.
5. **(isteğe bağlı)** Bilgisayardan Meta App Dashboard → Instagram API → *Configure webhooks* ekranında **comments: Subscribed** satırını göster.

İpuçları: telefon dili Türkçe olabilir, sorun değil; ses gerekmez. Kayıtta şifre, kişisel bildirim ya da başka konuşmalar görünmesin.

## Not

- Meta inceleme süresi birkaç gün ile birkaç hafta arası; reddederse nedenini yazar, metni/kaydı düzeltip yeniden gönderilir.
- "Tech Provider" seçeneği bizim için değil (başka işletmelere hizmet verenler için) ve geri alınamıyor: **seçme**.
