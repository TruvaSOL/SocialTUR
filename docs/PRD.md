# PRD — Sociativeworld.io (çalışma adı)

> Bu belge proje sahibinin başlangıç metnidir, olduğu gibi saklanır.
> Sonradan değişen kararlar burada düzeltilmez; `docs/DECISIONS.md` dosyasına yazılır ve o dosya önceliklidir.

## Rolün

Bu projede iki şapkan var. Birincisi kıdemli oyun tasarımcısı: her mekaniği "oyuncu yarın neden geri gelsin, bir yabancıyla neden konuşsun" sorusuyla tartarsın. İkincisi kıdemli web oyun mühendisi: telefonda akıcı çalışmayan hiçbir şeyi bitmiş saymazsın. İkisi çatışırsa bana seçenekleri ve bedellerini yaz, karar bende.

Ben projenin sahibiyim, yazılımcı değilim. Bana teknik jargonla değil, ne yaptığını ve ne göreceğimi anlatarak rapor ver. Kod ve yorumlar İngilizce, benimle yazışma Türkçe.

## Ne yapıyoruz

Sociativeworld.io: tarayıcıda çalışan, sonradan mobil uygulamaya sarılacak sosyal şehir oyunu. Tek ve ortak bir şehir var. Oyuncular şehre gelir, meslek seçip çalışır, ilk gün evini kazanır, evini döşer, birbirini ziyaret eder, ortak binaları birlikte inşa eder ve bu sırada tanışır. Hem oyun hem sosyal platform.

Çekirdek döngü: çalış → malzeme ve coin kazan → evini kur ve döşe → başkaları ziyaret etsin → ortak inşaya katkı ver → şehir büyüsün → yeni arsa ve meslek açılsın.

Oturum biçimi: telefon oyunu. Bir iş başlat (4 dakika ile 8 saat arası), çık, dönünce topla. Ekran açık bırakılırsa şehir kendi kendine yaşar ve izlenir.

Gelir modeli (beta sonrası): kozmetik. Temel ev iş karşılığı bedava; satılan şey güzel dış görünümlü evler, mobilya, kıyafet, hareket paketleri. Oyunda ilerleme satın alınmaz. Betada gerçek para yok; ödeme kodu yazma.

Referans ve neden farklıyız: miniakent.com aynı "şehirde sakin ol" fikrini yapıyor ama oynanışı izlemeden ibaret ve Godot web çıktısı kullandığı için ilk açılışta yaklaşık 48 MB indiriyor, telefonlarda kasıyor. Biz oyuncuya iş, sahiplik ve etkileşim veriyoruz ve bunu çok daha hafif bir teknolojiyle yapıyoruz. Miniakent'in varlıklarını, adını ya da kodunu kullanma; sadece ders al.

## Değişmez kararlar

- Tek ortak şehir. Geliştikçe mahalle mahalle büyür.
- Gerçek 3D, low-poly, sevimli ve sıcak görsel dil. Kamera kaydırılır, yakınlaşır, serbest döner. Ayrıca karakterin gözünden bakış modu var.
- İki dil: Türkçe ve İngilizce, ilk günden. Hiçbir metin koda gömülmez.
- Üyelik sitede (e-posta veya Google). Instagram kullanıcı adı isteğe bağlı bir profil alanıdır. Instagram'dan veri kazıma, takipçi listesi çekme, otomatik DM yok.
- Sunucu otoritesi: coin, envanter, iş süreleri ve inşa katkıları sunucu saatine göre sunucuda hesaplanır. İstemciden gelen hiçbir sayıya güvenilmez.
- Gerçek zamanlı aksiyon çok oyunculusu yok. Diğer oyuncuların konumu periyodik anlık görüntülerle gelir, istemcide yumuşatılarak canlandırılır. Sohbet ve bildirimler gerçek zamanlıdır.
- Başka hiçbir projemle bağ yok.

## Teknoloji

Önerim aşağıda. Daha iyi bir seçenek görürsen başlamadan önce gerekçesiyle söyle, onayımı al.

- İstemci: TypeScript, Vite, Three.js. Arayüz (paneller, editör, sohbet) tuvalin üstünde HTML/CSS; ağır bir arayüz çatısı kullanma.
- Arka uç: Supabase (Postgres, Auth, Realtime, satır düzeyi güvenlik). Oyun kuralları veritabanı fonksiyonlarında ya da edge function'larda; istemci sadece "şu işi başlat", "topla", "katkı ver" der.
- Barındırma: kod GitHub'da. Ön yüz her ana dal güncellemesinde otomatik yayınlanır (GitHub Actions; hedef GitHub Pages ya da eşdeğeri, hangisi alan adı ve yönlendirme için uygunsa onu öner).
- Varlık hattı: sıkıştırılmış glTF. Model klasöre girer, tek komutla ölçeklenir, ortak palet ve atlasa bağlanır, sıkıştırılır, oyuna hazır çıkar.
- Uygulamaya sarma (Capacitor) beta sonrası; şimdi yapma ama engelleyecek bir karar da verme.

Gizli anahtarları asla depoya yazma. Supabase ve alan adı hesaplarını ben açacağım; benden neyi, hangi adımla istediğini açıkça söyle ve .env.example bırak.

## Performans bütçesi (pazarlıksız)

Hedefler: ilk yükleme 6 MB altı; 4G'de 8 saniye içinde oynanabilir; 4 yıllık orta sınıf Android telefonda en az 30 fps; güncel telefonda 60 fps.

Kurallar:

- Tekrarlayan modeller instancing ile tek çizim çağrısında (ağaç, lamba, aynı tip ev).
- Işık pişirilmiş ya da çok ucuz; en fazla bir gerçek zamanlı gölge, zayıf cihazda kapalı.
- Tek ortak doku atlası ve sabit palet.
- Mahalleler yaklaştıkça yüklenir, uzaklaşınca bırakılır.
- İskelet animasyonu sadece yakındaki karakterlerde; uzaktakiler basit görünümle. Ekrandaki animasyonlu karakter sayısına üst sınır.
- Cihaza göre otomatik kalite: çözünürlük ve çizim mesafesi kare hızına göre ayarlanır.
- Sahne başına üçgen ve çizim çağrısı bütçesi belirle, belgeye yaz, her yeni varlığı bu bütçeyle kabul et.
- Geliştirme sürümünde her zaman açılabilen bir ölçüm katmanı olsun: fps, çizim çağrısı, üçgen, bellek, indirilen boyut.

## Görsel yön ve varlıklar

- Sevimli, sıcak, yumuşak köşeli low-poly. Sınırlı ve tutarlı bir renk paleti. Miniakent'ten belirgin biçimde daha özenli: daha iyi oranlar, daha iyi ışık, daha canlı animasyon.
- Animasyon önceliklidir. Karakterler kayarak değil ağırlıkla yürür; işler görünür hareketle yapılır (balta sallama, olta atma, çekiç); binalar inşa edilirken aşama aşama yükselir; toplama, ödül ve tamamlama anlarında küçük ama tatmin edici geri bildirim olur.
- Başlangıç için ticari kullanıma açık ücretsiz low-poly paketlerden yararlan (adaylar: Kenney, Quaternius; animasyon için hazır hareket kütüphaneleri). Her paketin lisansını kaynağından kendin doğrula ve ASSETS.md dosyasına kaynak, lisans, tarih olarak yaz. Lisansı net olmayan hiçbir şeyi kullanma.
- Karakter: tek iskelet, değiştirilebilir parçalar (saç, ten, üst, alt, ayakkabı, aksesuar). Hareketler: durma, yürüme, her meslek için bir çalışma hareketi, oturma, el sallama.
- Gece ve gündüz gerçek saate göre değişir.

## Beta kapsamı

Kapalı beta, 100-300 oyuncu. Cevaplanacak soru: insanlar ertesi gün geri geliyor mu?

1. Şehir: tek mahalle. Meydan, orman, sahil, liman alanı, boş arsalar, birkaç bank, vapur iskelesi.
2. Kamera: kaydırma, yakınlaştırma, serbest döndürme; karakterin gözünden bakış ve o bakışla yürüyüş.
3. Hesap: e-posta veya Google. Doğum tarihi sorulur. Dil seçimi.
4. Karakter editörü.
5. Şehre varış anı: yeni oyuncu vapurla gelir, meydanda adı duyurulur. Yakındaki oyuncular el sallarsa iki taraf da küçük ödül alır.
6. Kurucu sakin numarası: geliş sırasına göre kalıcı numara (Sakin #0047), profilde görünür.
7. Üç meslek: oduncu, balıkçı, inşaat işçisi. Her birinde kısa, orta ve uzun iş seçenekleri (4 dakikadan 8 saate).
8. İki kişilik işler: bazı işler iki oyuncuyla belirgin biçimde daha verimli. Tek başına da yapılır. Amaç yabancılara birlikte iş bahanesi vermek.
9. İlk ev: oyuncu ilk gününde, birkaç kısa oturumla arsa ve temel evini kazanır.
10. İç dekorasyon: tek oda, ızgara tabanlı editör, yaklaşık 30 mobilya, mobilya ve kamera döner.
11. Ortak inşa: liman. Herkes malzeme koyar; ilerleme herkese açık; bina aşama aşama yükselir; bitince açılış anı ve katkı verenlerin adı tabelada.
12. Ev ziyareti, beğeni, ziyaretçi defteri.
13. Kapı zili bildirimi: biri evini ziyaret ettiğinde ya da beğendiğinde oyun içi bildirim.
14. Sohbet: hazır ifadeler, emoji ve serbest yazı. Banka oturan iki karakter arasında özel bank sohbeti. Güvenlik katmanı bu maddenin parçasıdır, ayrı iş değildir: engelleme, şikâyet etme, küfür filtresi (TR ve EN), mesaj hız sınırı, 18 yaş altı için serbest yazı kısıtı, şikâyetleri görebileceğim basit bir yönetim ekranı.
15. Açık profil sayfası: /@kullaniciadi adresinde, oyuna girmeden görülebilen karakter ve ev kartı. Paylaşım görseli üretir.
16. AFK rutini: oyuncu yokken karakteri ev, iş ve meydan arasında kendi yürür, oturur, çalışır.
17. Coin: sadece oyun içinde kazanılır ve harcanır.
18. Uyum: çerez onayı, aydınlatma metni yer tutucusu, hesap silme, veri dışa aktarma. Analitik yalnız onayla çalışır.
19. Ölçüm: ertesi gün ve yedinci gün geri dönüş, ilk oturumda iş başlatma, ilk ev, ziyaret, inşa katkısı, sohbet kullanımı.

Betada olmayacaklar (istemeden ekleme): gerçek para ve mağaza, pazar yeri ve takas, evcil hayvan, araç, kulüpler, seçim ve belediye başkanı, oyuncu dükkânları, sponsor binalar, mini oyunlar, uygulama mağazası sürümü. Bunlar sonraki sürümler; veri modelini bunlara kapıyı kapatmayacak şekilde kur ama kodunu yazma.

## Ekonomi tasarımı

Sayıları koda gömme. Tüm iş süreleri, ödüller, fiyatlar ve inşa hedefleri veritabanındaki ayar tablolarından gelsin; yayın yapmadan değiştirebileyim.

Dengeyi şu hedeflere göre sen tasarla ve bana tablo olarak sun:

- İlk ev: ilk gün, toplam 3-4 kısa oturumla kazanılır.
- Bir odayı zevkli biçimde döşemek yaklaşık bir hafta sürer.
- Liman: beta nüfusuyla 7-10 günde biter; hedef nüfusa göre ölçeklenir.
- Günde iki-üç kez girip birkaç dakika oynayan oyuncu kendini geride hissetmez.
- Coin için anlamlı harcama yerleri vardır; birikip değersizleşmez.

Bu hedefleri doğrulayan küçük bir simülasyon betiği yaz (farklı oyuncu tipleri: günde bir giren, üç giren, sürekli açık tutan) ve sonucu göster. Ekonomi mantığı için otomatik test yaz.

## Çalışma düzeni

Sırayla ilerle. Her aşamanın sonunda dur, bana ne yaptığını, nasıl deneyeceğimi (telefonumdan açacağım adres dahil) ve bir sonraki aşamada ne olacağını yaz. Onayım olmadan sonraki aşamaya geçme.

- Aşama 0, plan: depoyu kur, bu metni docs/PRD.md olarak kaydet, mimari özetini ve veri modelini docs/ altında yaz, benden hangi hesapları açmamı istediğini listele. Kod yazmadan önce dur ve onay al.
- Aşama 1, stil kilidi: bir ev, bir karakter (yürürken), bir ağaç, küçük bir zemin parçası. Işık, palet ve oranlar burada sabitlenir. Yayına al ki telefonumda göreyim. Beğenmeden başka varlık üretme.
- Aşama 2, performans kapısı: tam bir mahalle, serbest kamera, göz hizası bakış, 100 yürüyen karakter. Ölçüm katmanıyla gerçek telefonda test edeceğim. 30 fps tutmuyorsa önce içerik bütçesini düşürmeyi öner; yine tutmuyorsa bana seçenekleri getir.
- Aşama 3: hesap, dil altyapısı, karakter editörü, varış anı, sakin numarası.
- Aşama 4: meslekler, iş zamanlayıcıları, coin ve envanter (sunucu tarafı), iki kişilik işler, ekonomi tablosu ve simülasyon.
- Aşama 5: arsa, ilk ev, iç dekorasyon editörü.
- Aşama 6: liman ortak inşası.
- Aşama 7: ziyaret, beğeni, ziyaretçi defteri, kapı zili, açık profil sayfası.
- Aşama 8: sohbet ve güvenlik katmanı, bank sohbeti, yönetim ekranı.
- Aşama 9: AFK rutini, gece-gündüz, şehir canlılığı, animasyon ve geri bildirim cilası.
- Aşama 10: uyum ekranları, ölçüm, yük testi (300 eşzamanlı oyuncu varsayımı), beta kontrol listesi.

Kurallar:

- Küçük ve açıklayıcı commit'ler. Ana dal her zaman çalışır durumda.
- Önemli her kararı docs/DECISIONS.md dosyasına tarih ve gerekçeyle yaz.
- Emin olmadığın yerde tahmin etme, sor. Benim kararlarımla çelişen bir şey fark edersen uygulamadan önce söyle.
- Kapsam dışı fikir gelirse docs/IDEAS.md dosyasına not et, uygulama.
- Bir şeyi "bitti" demeden önce kendin çalıştır ve doğrula; doğrulayamadığın şeyi doğrulanmamış olarak bildir.
- Silme, veritabanını sıfırlama, zorla gönderme gibi geri alınamaz işlemlerden önce planı göster ve açık onayımı bekle.
