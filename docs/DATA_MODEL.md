> **Not (2026-11-17):** Bu belge şehir oyunu için yazıldı. Oyun stadyuma dönüştü (karar #34). Güncel veri modeli: `supabase/migrations/0002_stadium.sql`; güncel yapı: `src/stadium/`.

# Veri modeli

Veritabanında neyin tutulduğunun taslağı. Tablo ve sütun adları İngilizce (kodla aynı dil). Aşama 3'ten itibaren parça parça kurulur; her aşama yalnızca kendi tablolarını ekler.

Genel kurallar:

- Oyuncular tablolara doğrudan yazamaz; her değişiklik bir kural fonksiyonundan geçer.
- Zamanlar sunucu saatidir.
- Sayılar (süre, ödül, fiyat, hedef) yalnızca ayar tablolarında durur.

## Hesap ve kimlik

| Tablo | Ne tutar | Not |
|-------|----------|-----|
| `profiles` | kullanıcı adı, sakin numarası, doğum tarihi, dil, isteğe bağlı Instagram adı, varış zamanı | Doğum tarihi gizlidir; dışarıya yalnızca "reşit / değil" bilgisi kullanılır. |
| `resident_counter` | sıradaki sakin numarası | Numara bir kez verilir, hesap silinse de yeniden kullanılmaz. |
| `characters` | görünüm parçaları (saç, ten, üst, alt, ayakkabı, aksesuar) | Parçalar `items` tablosuna bağlanır; ileride satılan kıyafetler aynı yoldan gelir. |
| `consents` | çerez ve analitik onayı, tarih, metin sürümü | |
| `admins` | yönetim ekranına girebilenler | |

## Ayar tabloları (yayın yapmadan değiştirilir)

| Tablo | Ne tutar |
|-------|----------|
| `settings` | tekil ayarlar: el sallama ödülü, mesaj hız sınırı, günlük verim freni vb. |
| `professions` | meslekler (oduncu, balıkçı, inşaat işçisi) ve açılma koşulu |
| `job_variants` | her mesleğin kısa/orta/uzun işleri: süre, ödüller, iki kişilik çarpan |
| `items` | her eşya: tür (malzeme, mobilya, ev dış görünümü, kıyafet), fiyat, kapladığı kare, model dosyası |
| `build_projects` | ortak inşalar (liman) ve durumları |
| `build_stages` | inşanın aşamaları ve her aşamanın malzeme hedefi; hedef nüfusa göre ölçeklenir |
| `districts` | mahalleler ve açılma koşulu |

## Ekonomi

| Tablo | Ne tutar | Not |
|-------|----------|-----|
| `wallets` | oyuncunun coin bakiyesi | Yalnızca defterle birlikte değişir. |
| `coin_ledger` | her coin hareketi: kim, miktar, neden, neye bağlı | Silinmez, değiştirilmez. |
| `inventory` | oyuncu başına eşya ve adet | |
| `player_jobs` | başlatılan işler: hangi iş, başlangıç, bitiş, ortak, toplandı mı | Bitiş sunucuda hesaplanır; aynı iş iki kez toplanamaz. |
| `job_partnerships` | iki kişilik iş eşleşmeleri | Sonradan katılmaya izin verir. |

## Ev

| Tablo | Ne tutar |
|-------|----------|
| `plots` | arsalar: mahalle, konum, sahibi |
| `houses` | ev: arsa, sahibi, dış görünüm, oda boyutu |
| `house_placements` | odadaki mobilyalar: eşya, kare konumu, yön |

## Ortak inşa

| Tablo | Ne tutar | Not |
|-------|----------|-----|
| `build_contributions` | kim, hangi malzemeden, ne kadar, ne zaman | Tabela adları ve ilerleme buradan çıkar. |

## Sosyal

| Tablo | Ne tutar | Not |
|-------|----------|-----|
| `player_state` | karakterin şu anki durumu: yer, etkinlik, başlangıç, hedef | Diğer telefonlar şehri bundan canlandırır. |
| `arrivals` | varış duyuruları | |
| `waves` | el sallamalar ve verilen ödül | Aynı çifte ödül sınırı burada denetlenir. |
| `visits` | ev ziyaretleri | |
| `likes` | ev beğenileri (oyuncu başına ev başına bir) | |
| `guestbook_entries` | ziyaretçi defteri yazıları | Sohbetle aynı filtreden geçer. |
| `notifications` | kapı zili ve diğer bildirimler, okundu bilgisi | |

## Sohbet ve güvenlik

| Tablo | Ne tutar | Not |
|-------|----------|-----|
| `chat_channels` | kanallar: meydan, bank (iki kişilik) | |
| `chat_messages` | mesajlar: tür (hazır ifade, emoji, serbest yazı), metin | Filtre ve hız sınırı sunucuda uygulanır. |
| `blocks` | kim kimi engelledi | |
| `reports` | şikâyetler: kim, kimi, neyi, durum | Yönetim ekranı bunu gösterir. |
| `moderation_actions` | verilen cezalar: susturma, uzaklaştırma, süre, veren | |
| `word_filters` | TR ve EN yasaklı kelime listesi | Ayar gibi düzenlenir. |

## Ölçüm ve uyum

| Tablo | Ne tutar | Not |
|-------|----------|-----|
| `analytics_events` | onay veren oyuncuların olayları: oturum, iş başlatma, ilk ev, ziyaret, katkı, sohbet | Onay yoksa satır yazılmaz. |
| `deletion_requests` | hesap silme istekleri ve durumu | |

Hesap silme: kişisel veriler silinir; sakin numarası boşta kalır ve yeniden verilmez; liman tabelasındaki ad "Eski sakin" olur; coin defteri kimliksiz kalır.

## Sonraki sürümlere açık kapılar (kodu yazılmayacak)

- **Mağaza ve gerçek para:** `items` tablosu zaten kozmetik türlerini taşıyor; ileride ayrı bir satın alma tablosu eklenir, coin defterine dokunulmaz.
- **Pazar yeri, takas, oyuncu dükkânları:** `inventory` ve `coin_ledger` iki oyuncu arası aktarımı kaldıracak yapıda.
- **Yeni mahalle ve meslekler:** `districts` ve `professions` satır eklemekle büyür.
- **Kulüpler, seçim, evcil hayvan, araç:** mevcut tablolara dokunmadan yeni tablolarla eklenebilir.
