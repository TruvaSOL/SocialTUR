# Instagram: yoruma otomatik bilet

Amaç: gönderinin altına "stadyum" yazan kişiye, içinde bilet kodu hazır bir bağlantı kendiliğinden gitsin. Kişi bağlantıya dokunur, karakterini yapar, koltuğuna geçer. Kod yazmaz; sen elle bir şey göndermezsin.

## Parçalar

1. **Instagram hesabı** işletme ya da içerik üretici hesabı olmalı (Ayarlar → Hesap türü; ücretsiz).
2. **Mesaj aracı**: yorumu görüp özel mesajı gönderen servis. ManyChat ya da benzeri, Meta onaylı bir araç.
3. **Bilet ucu**: mesaj aracının çağırdığı adres. Instagram hesabı başına tek bilet üretir ve bağlantıyı döndürür. Supabase'de `issue_ticket` adıyla durur (bkz. `supabase/migrations/0003_instagram_tickets.sql`).

## Bilet ucu

| | |
|---|---|
| Adres | `https://ncbmkepmvbkofcpajadc.supabase.co/rest/v1/rpc/issue_ticket` |
| Yöntem | POST |
| Başlık | `apikey: <herkese açık anahtar>` ve `Content-Type: application/json` |
| Gövde | `{"p_secret": "<gizli anahtar>", "p_ig_user_id": "<kişinin Instagram kimliği>", "p_ig_username": "<kullanıcı adı>"}` |
| Cevap | `{"ok": true, "code": "ABCD-EFGH", "url": "https://socialtur.pages.dev/?kod=ABCD-EFGH", "used": false, "new": true}` |

- **Herkese açık anahtar:** Supabase → Project Settings → API Keys → Publishable key.
- **Gizli anahtar:** Supabase → Table Editor → `private_config` tablosu → `ticket_issuer` satırı. Veritabanında üretildi; hiçbir sohbette ya da depoda geçmez. Yalnızca mesaj aracına yapıştırılır.
- Aynı kişi ikinci kez yorum yazarsa aynı bağlantı döner (`"new": false`). Bileti kullanmışsa `"used": true` gelir.
- Stadyum dolduysa `{"ok": false, "error": "full"}`, gizli anahtar yanlışsa `{"ok": false, "error": "forbidden"}` döner.

## ManyChat kurulumu (özet)

Menü adları değişebilir; mantık aynıdır.

1. ManyChat'te Instagram hesabını bağla.
2. Yeni bir otomasyon: tetikleyici **"Kullanıcı gönderiye yorum yazar"**, anahtar kelime `stadyum`.
3. İlk adım: **External Request** (dış istek). Yukarıdaki adresi, başlıkları ve gövdeyi gir. Gövdede kişinin kimliği için ManyChat'in "Instagram kullanıcı kimliği", kullanıcı adı için "Instagram kullanıcı adı" alanlarını seç.
4. Cevaptaki `url` alanını bir özel alana (örneğin `bilet_linki`) eşle.
5. Sonraki adım: kişiye mesaj gönder. Metin:

   > Biletin hazır! 🎟️
   > Buradan gir: {{bilet_linki}}
   > Karakterini yap ve yerine geç. İlk gelen en iyi koltuğu alır!

6. İstersen yoruma herkese açık kısa bir yanıt da ekle: "Biletin mesaj kutunda! 🎟️"

Dış istek özelliği ManyChat'in ücretli planındadır.

## Meta'nın sınırları

- Yorum başına tek özel mesaj gönderilebilir; kişi cevap yazmazsa ikinci mesaj atılamaz.
- Seni takip etmeyen kişiye giden mesaj "İstekler" klasörüne düşer.
- Mesaj, yorumdan sonraki 7 gün içinde gönderilebilir.
- Bir kişinin seni takip edip etmediği sorgulanamaz; yorum yazan herkes bilet alır.

## Koltuk ve Instagram adı

Bilet bir Instagram hesabı için üretildiğinden, kişi koltuğa geçtiğinde Instagram kullanıcı adı profiline kaydedilir. Bu ad şimdilik hiçbir yerde gösterilmez; yalnızca veritabanında durur.
