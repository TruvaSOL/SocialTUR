# Performans bütçesi

Her yeni varlık ve özellik bu sayılarla kabul edilir. Sayılar başlangıç tahminidir; Aşama 2'de gerçek telefonda ölçülüp kesinleştirilecek ve bu belge güncellenecek.

## Hedefler

| Hedef | Değer | Not |
|-------|-------|-----|
| İlk yükleme | 6 MB altı | Oynanabilir hale gelene kadar inen her şey. Yayında otomatik denetlenir. |
| 4G'de oynanabilir olma | 8 saniye içinde | |
| Güncel telefon | 60 fps | |
| Son 2-3 yılın orta sınıf telefonu | en az 30 fps | Karar #4: eski Android öncelik değil; bu taban onay bekliyor. |
| Daha eski cihazlar | otomatik kalite, garanti yok | |

## İlk yükleme dağılımı (6 MB)

| Kalem | Bütçe |
|-------|-------|
| Oyun kodu (sıkıştırılmış) | 0,5 MB |
| Arayüz, yazı tipi, dil dosyaları | 0,3 MB |
| Ortak doku atlası | 0,3 MB |
| Mahalle modelleri (binalar, doğa, eşyalar) | 2,0 MB |
| Karakter, parçalar ve hareketler | 1,5 MB |
| Ses (ilk açılışta yalnızca kısa efektler) | 0,4 MB |
| Pay | 1,0 MB |

Ev içi mobilyalar ve müzik ilk yüklemeye dahil değildir; gerektiğinde iner.

## Sahne bütçesi (ekranda aynı anda)

| Kalem | Orta sınıf telefon | Güncel telefon |
|-------|--------------------|----------------|
| Çizim çağrısı | 100 | 150 |
| Üçgen | 150.000 | 300.000 |
| Gerçek iskeletle canlanan karakter | 16 | 32 |
| Toplu çizilen uzak karakter | 200 | 300 |
| Gerçek zamanlı gölge | 1 (zayıf cihazda kapalı) | 1 |
| Doku | tek atlas, 1024 kare | tek atlas, 1024 kare |

## Varlık başına üçgen sınırı

| Varlık | Üçgen |
|--------|-------|
| Karakter (bütün parçalarıyla) | 2.500 |
| Kalabalık karakteri | 600 |
| Ev (dış) | 2.000 |
| Büyük ortak bina (liman, aşama başına) | 6.000 |
| Ağaç | 450 |
| Küçük eşya (bank, lamba) | 200 |
| Mobilya | 400 |

## Ölçümler

| Tarih | Sahne | Çizim çağrısı | Üçgen | Yayın boyutu | Kare hızı |
|-------|-------|---------------|-------|--------------|-----------|
| 2026-11-14 | Aşama 1: zemin, ev, ağaç, bir karakter, 4 bulut | 30 | 18.136 | 0,59 MB (sıkıştırılmamış toplam) | ölçülemedi |
| 2026-11-14 | Aşama 2, kuş bakışı, bütün mahalle, 150 kişi | 40 | 232.138 | 0,60 MB | ölçülemedi |
| 2026-11-14 | Aşama 2, kuş bakışı, bütün mahalle, 200 kişi | 40 | 262.438 | 0,60 MB | ölçülemedi |
| 2026-11-14 | Aşama 2, göz hizası, sokak boyunca (150 kişiden 50-70'i görünür) | 35-36 | 145.000-166.000 | 0,60 MB | ölçülemedi |
| 2026-11-14 | Ada sürümü (deniz, 3 ev modeli, liman, belediye, kafe, park hepsi bitmiş), kuş bakışı, 200 kişi | 41 | 274.726 | 0,65 MB | ölçülmedi |
| 2026-11-14 | Ada sürümü, göz hizası, 200 kişiden 94'ü görünür | 39 | 208.844 | 0,65 MB | ölçülmedi |

Aşama 1 satırı gölge geçişini de içerir. Aşama 2'de gölge yalnızca bir kez çizildiği için satırlar olağan kareyi gösterir; gölgenin çizildiği tek karede sayılar yaklaşık iki katıdır.

Aşama 2 mahallesinin dökümü: zemin ve küçük süsler 24.912 üçgen (tek çizim), 52 ev x 1.124, 114 ağaç x 434, kalabalık karakteri 600, oyuncunun kendi karakteri yaklaşık 2.400. Kalabalığın işlemci maliyeti bu bilgisayarda 200 kişi için kare başına 0,4 milisaniye.

**Kare hızı bu bilgisayarda ölçülemez.** Bilgisayarda ekran kartı yok; tarayıcı görüntüyü işlemciyle üretiyor ("Microsoft Basic Render Driver") ve saniyede 7-10 kare veriyor. Bu sayı telefon hakkında hiçbir şey söylemez. Performans kapısının kararı gerçek telefonda verilecek.

Kuş bakışında üçgen sayısı orta sınıf telefon bütçesinin (150.000) üstünde, güncel telefon bütçesinin (300.000) altında. Telefonda yetmezse sıradaki önlemler: uzak evler ve ağaçlar için sade model, kalabalıkta uzak karakterler için daha sade model.

**İlk telefon denemesi (2026-11-14):** Samsung Galaxy Z Fold 7, yayın adresi, en yüksek kalite sabit (`?quality=1`). Sahibinin değerlendirmesi: "gayet iyi gözüküyor", kare hızı yaklaşık 100. Bu telefon en üst sınıf bir cihaz; orta sınıf telefon tabanı (karar #4) henüz hiçbir cihazda denenmedi.

Telefonda ölçüm için adres seçenekleri: `?stats` ölçüm katmanını açar; `?quality=1` (1-6) otomatik kaliteyi durdurup tek bir kalite basamağını sabitler, böylece ham kare hızı okunur.

## Kurallar

- Tekrarlayan her model tek çizim çağrısında toplanır.
- Işık ucuz: bir güneş, bir ortam ışığı, en fazla bir gölge. Gölgeyi yalnızca duran şeyler (ev, ağaç) düşürür ve gölge bir kez çizilir; yürüyen karakterlerin altında koyu bir yuvarlak leke vardır.
- Kalabalıkta yalnızca ekranda görünen karakterler hesaplanır ve çizilir.
- Renkler ortak paletten; modelin kendi dokusu kabul edilmez.
- Kalite otomatik: kare hızı düşerse önce çözünürlük, sonra gölge, sonra çizim mesafesi ve karakter sayısı azalır.
- Yapay zekâ ile üretilen modeller (karar #5) bu sınırlara indirilmeden oyuna giremez.
