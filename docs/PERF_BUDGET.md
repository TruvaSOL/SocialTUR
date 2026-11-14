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
| Uzak karakter | 400 |
| Ev (dış) | 2.000 |
| Büyük ortak bina (liman, aşama başına) | 6.000 |
| Ağaç | 300 |
| Küçük eşya (bank, lamba) | 200 |
| Mobilya | 400 |

## Ölçümler

| Tarih | Sahne | Çizim çağrısı | Üçgen | Yayın boyutu | Kare hızı |
|-------|-------|---------------|-------|--------------|-----------|
| 2026-11-14 | Aşama 1: zemin, ev, ağaç, bir karakter, 4 bulut | 30 | 18.136 | 0,59 MB (sıkıştırılmamış toplam) | ölçülemedi |

Çizim çağrısı ve üçgen sayıları gölge geçişini de içerir. Kare hızı geliştirme ortamında ölçülemedi (önizleme penceresi arka planda çalıştığı için kare üretmiyor); gerçek telefonda ölçülecek.

## Kurallar

- Tekrarlayan her model tek çizim çağrısında toplanır.
- Işık ucuz: bir güneş, bir ortam ışığı, en fazla bir gölge.
- Renkler ortak paletten; modelin kendi dokusu kabul edilmez.
- Kalite otomatik: kare hızı düşerse önce çözünürlük, sonra gölge, sonra çizim mesafesi ve karakter sayısı azalır.
- Yapay zekâ ile üretilen modeller (karar #5) bu sınırlara indirilmeden oyuna giremez.
