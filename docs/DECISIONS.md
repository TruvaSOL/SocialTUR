# Kararlar

Her önemli karar tarih ve gerekçesiyle buraya yazılır. Bu dosya `PRD.md` ile çelişirse bu dosya geçerlidir.
"Durum" sütunu: **Kesin** (sahibi söyledi), **Öneri** (onay bekliyor), **Açık** (henüz karar yok).

## 2026-11-14

| # | Karar | Durum | Gerekçe / not |
|---|-------|-------|---------------|
| 1 | Ön beta yok. Oyun doğrudan herkese açılır, hatalar yayındayken düzeltilir. | Kesin | Sahibinin kararı. PRD'deki "kapalı beta, 100-300 oyuncu" ifadesinin yerini alır. Sonuç: oyuncu sayısı öngörülemez; liman hedefi ve sunucu planı sabit 300'e göre değil, gerçek nüfusa göre ölçeklenecek şekilde kurulur. Moderasyon ve güvenlik katmanı açılış gününde hazır olmalıdır. |
| 2 | "Boş şehir" bir risk sayılmıyor: başta herkes aynı küçük alanda olacak. | Kesin | Sahibinin kararı. Yine de el sallama ve iki kişilik iş, iki oyuncu aynı anda çevrimiçi olmasa da çalışacak biçimde tasarlanır (zarar vermez, gece saatlerinde işe yarar). Bu ek tasarım benim yorumum; Aşama 3 ve 4'te ayrıca gösterip onay alacağım. |
| 3 | Ekranda 100'den fazla karakter beklenir. | Kesin | Sahibinin tahmini. Kalabalık sistemi 100 değil 150-200 karaktere göre boyutlandırılır (bkz. `PERF_BUDGET.md`). |
| 4 | Eski Android telefonlar öncelik değil. | Kesin | Sahibinin kararı. PRD'deki "4 yıllık orta sınıf Android'de 30 fps" şartı pazarlıksız olmaktan çıkar. Yeni taban (benim yorumum, onay bekliyor): son 2-3 yılın orta sınıf telefonunda 30 fps, güncel telefonda 60 fps; daha eski cihazlarda otomatik kalite elinden geleni yapar. 6 MB ilk yükleme hedefi aynen kalır. |
| 5 | 3D modeller gerektiğinde Higgsfield ile üretilebilir. | Kesin | Sahibinin kararı. Not: yapay zekâ ile üretilen modeller genelde çok yoğun ve kendi dokusuyla gelir; ortak palet, tek atlas ve üçgen bütçesine uyması için varlık hattında sadeleştirilmesi gerekir. Aşama 1'de bir modelle denenip ölçülecek. Tek iskeletli, parçaları değişen karakter bu yolla gelmeyebilir; o ayrı değerlendirilecek. Üretim Higgsfield kredisi harcar; her üretimden önce sahibine sorulur. |
| 6 | Bank sohbeti 18 yaş altı için sorun olursa kaldırılır. | Kesin | Sahibinin kararı. Varsayılan uygulama: 18 yaş altı hesaplarda özel bank sohbeti kapalı. Tamamen kaldırma kararı Aşama 8'de verilir. |
| 7 | Alan adı ve oyunun adı henüz kesin değil. | Kesin | "Sociativeworld" çalışma adıdır. Ad hiçbir yerde koda gömülmez; tek bir ayar dosyasından ve dil dosyalarından gelir. Yayın, barındırma hizmetinin verdiği ücretsiz adresle başlar. |
| 8 | Test telefonu sonra belirlenecek. | Kesin | Aşama 2'ye (performans kapısı) kadar gerekli değil. |
| 9 | Barındırma: GitHub Pages yerine Cloudflare Pages. | Öneri | /@kullaniciadi sayfasının paylaşım önizlemesi için sunucunun profil başına bilgi üretmesi gerekir; GitHub Pages bunu yapamaz. Cloudflare Pages ayrıca gizli depoyla çalışır ve her aşamaya ayrı deneme adresi verir. Bedeli: bir hesap daha. |
| 10 | Konum paylaşımı: sunucu "kim, nerede, ne yapıyor, ne zamandan beri" bilgisini tutar; yürüyüşü her telefon kendi canlandırır. | Öneri | PRD'deki "periyodik anlık görüntü" kararıyla uyumlu, daha ucuz ve daha akıcı. Ayrıntı `ARCHITECTURE.md` içinde. |
| 11 | Alt yaş sınırı. | Açık | Aşama 3'ten önce karar gerekli. Öneri: açılışta 18+ (en basit ve güvenli) ya da 13+ ve kısıtlı sohbet. Aydınlatma metni bir hukukçuya gösterilmeli. |
| 12 | Projenin kalıcı klasörü ve GitHub deposu. | Açık | Aşama 1'de yayın için gerekli. |
| 13 | Aşama 1 varlıkları (ev, ağaç, zemin, karakter) hazır paketten alınmadı, kodla üretildi. | Öneri | Palet, oran ve ışık üzerinde tam denetim verir; lisans sorusu yoktur; dört varlığın tamamı kodla birlikte 0,6 MB'ın içindedir. Bedeli: her yeni varlık elle tarif edilir, organik biçimler (hayvan, ayrıntılı yüz) zordur. Higgsfield ya da hazır paket modelleri yine eklenebilir. Sahibi görseli beğenirse bu yol stil olarak kilitlenir. |
| 14 | Karakter: tek iskelet üzerinde, eklemlere bağlı katı parçalar (oyuncak bebek gibi); esneyen deri yok. Hareketler dosyadan değil koddan gelir. | Öneri | Kalabalıkta çok ucuzdur: 200 karakter birkaç çizim çağrısına sığar. Eksik meslek hareketleri (balta, olta, çekiç) paket aramadan yazılabilir. Parça değiştirmek (saç, üst, alt, ayakkabı) kolaydır. Bedeli: eklem yerleri görünür, hareket hazır insan animasyonları kadar yumuşak değildir. Alternatif: Quaternius gövdesi ve hareket kütüphanesi (daha gerçekçi, daha ağır, meslek hareketleri eksik). |
| 15 | Varlık hattı (glTF sıkıştırma komutu) Aşama 1'de yazılmadı. | Kesin | Oyunda henüz dışarıdan gelen model yok; denenemeyecek bir araç yazmak yerine ilk dış model (ör. Higgsfield denemesi) geldiğinde yazılacak. Aşama 1 planımdan sapmadır. |
| 16 | Geliştirme sunucusu yalnızca bu bilgisayarı dinler, ağa açılmaz. | Kesin | Bilgisayarın herkese açık bir internet adresi var; korumasız bir geliştirme sunucusunu oraya açmak güvenli değil. Telefonda deneme yayın adresiyle yapılır. |
