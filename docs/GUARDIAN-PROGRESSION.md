# Muhafız gelişimi / Guardian progression

## Türkçe

v2.16.0 eğitim bedeli hedef rütbeye göre artar: ot **40 / 140 / 450 / 1.400 / 4.200**, yem **80 / 280 / 900 / 2.800 / 8.400**. Her adım ayrıca bir yetenek puanı harcar. Panel ve sunucu aynı güncel tarifeyi kullanır; eski eğitimlere ek borç çıkarılmaz. [Ekonomi](ECONOMY.md).

**v2.3.0:** Muhafız ekranı rol, can, deneyim, eğitim puanı ve ekipmanı birlikte gösterir. Eğitim ve ekipman seçeneklerinde etkiler ve işlem engelleri açıklanır. Kurt seçmek kaynak harcamaz; bütün işlemler mevcut sunucu kaydını kullanır.

### Deneyim ve eğitim

Savaş zaferinde bütün kurtlar `35 + dalga × 5` XP alır. Keşif/sevkiyatta yalnızca seçilen katılımcılar görev XP'si kazanır. Bir sonraki seviye için mevcut seviye × 45 XP gerekir. Seviye atlamak bir eğitim puanı, +6 azami can ve yeni azami canı aşmadan +18 can verir. En yüksek seviye 20'dir; ekran bu sınırı belirtir.

Bir eğitim **bir puan** ve hedef rütbenin yukarıda belirtilen ot/yem bedelini harcar; ilk rütbe **40 ot + 80 yem** ister. Seçilen yol bir kademe ilerler; yol başına sınır 5'tir. Muhafız yolu mevcut ve azami canı 4, diğer yollar 2 artırır. Her kurt dört yolu da geliştirebilir; eğitim karakterin rolünü değiştirmez.

| Yol     | Savaş etkisi, kademe başına                                                                  |
| ------- | -------------------------------------------------------------------------------------------- |
| Muhafız | Alınan hasarın bölenine +0,12 katkı                                                          |
| Avcı    | Temel saldırıya +1,2                                                                         |
| Lider   | Temel saldırıya +0,3; hayattaki kurtların toplam lider kademesi sürü paniği artışını azaltır |
| Şifacı  | Her dördüncü çatışma adımındaki takım iyileştirmesine +3                                     |

Savunma katkısı doğrudan yüzde hasar indirimi değildir: muhafız kademesi, sığınak seviyesi ve ekipman savunması aynı böleni oluşturur. Temel saldırı son hasar değildir; taktik, formasyon ve binalar sonucu değiştirir. Şifa, hayattaki en düşük can oranlı kurda uygulanır. Liderlik mevcut paniği anında silmez, sonraki artışı azaltır.

Aktif savaş, seçilen kurdun görevde olması, puan/kaynak eksikliği veya yol sınırı eğitimi engeller. Diğer kurtlar seferdeyken obada kalan kurt eğitilebilir. Kaynak üretimiyle uygunluk yenilenir; sunucu işlem anında tekrar denetler.

### Ekipman

Bir kurt aynı anda **bir eşya** kuşanır. Eşyalar keşif/sevkiyat ödüllerinden veya kabul edilmiş arkadaşların hediyelerinden gelir. Envanter sayısı kuşanılmamış parçaları gösterir. Takas ve çıkarma eski eşyayı envantere iade eder; eski eşyanın stoğu 10.000 sınırındaysa işlem engellenir.

| Eşya                | Saldırı | Savunma | Yolculuk                             | İyileştirme |
| ------------------- | ------: | ------: | ------------------------------------ | ----------: |
| Deri muhafız yeleği |       0 |      +3 | —                                    |           0 |
| Demir boyun zırhı   |      +2 |      +6 | —                                    |           0 |
| İzci nişanı         |      +1 |       0 | Katıldığı seferin erzağında %15 indirim |           0 |
| Şifacı heybesi      |       0 |      +1 | —                                    |          +3 |

Karttaki farklar mevcut kuşanılan parçayla karşılaştırılır. Örneğin deri yelekten demir zırha geçiş +2 saldırı ve +3 ham savunma katkısı verir; panel bu savunma katkısının kişisel hasar azaltma oranındaki sonucunu yüzde puan farkıyla gösterir. Sığınak ve formasyon bu kişisel kıyasa dahil değildir. İzci nişanı yalnızca onu taşıyan kurt sefere katılıyorsa etkilidir; toplam yola çıkış su/yem indirimi %30'u aşmaz. Yeni seferlerin sabit süresi değişmez. Aktif savaşta veya seçilen kurt görevdeyken ekipman değişmez. İnceleme kaynak harcamaz; **Kuşan / Çıkar** işlemini sunucu doğrular.

Gerçekçi zırhlı portreler **rol çizimleridir**. Alfa, Muhafız, Avcı, İzci ve Şifacı ayrı portreler kullanır. Portredeki zırh, takılı ekipmanın birebir görseli değildir; gerçek eşya adı ve etkisi panelde gösterilir. Ekipmanla değişen katmanlı karakter çizimi henüz uygulanmamıştır.

### Çevrimdışı deneme ve dağıtım

[guardians.html](../preview/guardians.html) internet olmadan açılan tek dosyadır. Gerçek arayüz bileşenini kurgusal muhafızlarla kullanır. Beş kurt arasında geçiş, TR/EN, açık/kahverengi koyu tema ve hazır/erzak eksik/seferde/seviye sınırı örnekleri çalışır. Eğitim ve ekipman işlemleri kapalıdır; ağ isteği, oyuncu oturumu veya oyun kaydı yoktur. `npm run build:preview` dosyayı yeniler.

v2.16.0 eğitim maliyetlerini günceller ve kayıtları v3 biçimine geçirir; mevcut kurtların gelişimi, ekipmanları ve puanları korunur. [Ekonomi rehberi](ECONOMY.md) geçişi açıklar. Dokploy'da mevcut volume'ları koruyarak güncel `main` sürümünü dağıtın; yeni ENV anahtarı gerekmez.

## English

v2.16.0 training scales with target rank: herbs **40 / 140 / 450 / 1,400 / 4,200**, feed **80 / 280 / 900 / 2,800 / 8,400**. Each step also spends a skill point. UI and server share the same current quote; previous training is not charged again. [Economy](ECONOMY.md).

**v2.3.0:** The guardian screen combines role, health, experience, training points and equipment. Training and equipment options explain their effects and action blockers. Selecting a wolf spends nothing; actions use the existing server save.

### Experience and training

A battle victory grants every wolf `35 + wave × 5` XP. Only selected participants earn exploration/escort XP. The next level requires current level × 45 XP. Each level grants one training point, +6 maximum health and +18 health, capped at the new maximum. The level cap is 20 and is identified on screen.

Training costs **one point** plus the target rank's herbs/feed tariff listed above; the first rank costs **40 herbs + 80 feed**. Each action raises one path by one rank, up to rank 5 per path. Guardian training adds 4 current/maximum health; other paths add 2. Any wolf can develop all four paths; training does not change its role.

| Path     | Combat effect per rank                                                         |
| -------- | ------------------------------------------------------------------------------ |
| Guardian | +0.12 to the incoming-damage divisor                                           |
| Hunter   | +1.2 base attack                                                               |
| Leader   | +0.3 base attack; total leader ranks of living wolves reduce herd panic growth |
| Healer   | +3 team healing every fourth combat step                                       |

Defense contribution is not a direct percentage reduction: guardian rank, shelter level and equipment defense contribute to the same incoming-damage divisor. Base attack is not final damage; tactics, formation and buildings modify the result. Healing targets the living wolf with the lowest health ratio. Leadership reduces subsequent panic growth rather than instantly removing existing panic.

An active battle, the selected wolf being away, insufficient points/resources or the path cap prevents training. Wolves at home may train while others are away. Availability updates with production; the server checks it again when an action is submitted.

### Equipment

A wolf can wear **one item**. Equipment comes from exploration/escort rewards or gifts from accepted friends. Inventory counts represent unequipped pieces. Replacing/removing equipment returns the old item to inventory; an existing stock of 10,000 for that item blocks the return.

| Item           | Attack | Defense | Journey                           | Healing |
| -------------- | -----: | ------: | --------------------------------- | ------: |
| Leather vest   |      0 |      +3 | —                                 |       0 |
| Iron guard     |     +2 |      +6 | —                                 |       0 |
| Scout insignia |     +1 |       0 | 15% supplies discount when its wearer joins |       0 |
| Healer satchel |      0 |      +1 | —                                 |      +3 |

Card differences compare each candidate with the currently equipped item. Replacing a leather vest with an iron guard adds +2 attack and +3 raw defense contribution; the panel translates this defense contribution into the resulting personal damage mitigation, comparing percentage points. Shelter and formation are excluded from this personal comparison. Scout insignia affect only journeys joined by their wearers, with a combined departure water/feed discount capped at 30%. New journeys retain their fixed duration. Equipment cannot change during battle or while the selected wolf is away. Inspection spends nothing; **Equip / Unequip** actions are validated on the server.

Realistic armored portraits are **role illustrations**. Alpha, Guardian, Hunter, Scout and Healer have separate portraits. The depicted armor is not an exact representation of the equipped item; its actual name and effects appear in the panel. Layered character artwork that changes with equipment is not implemented yet.

### Offline preview and deployment

[guardians.html](../preview/guardians.html) opens as one self-contained file without internet. It uses the actual interface component with fictional guardians. Switch among five wolves, TR/EN and light/brown dark themes, or inspect ready/low-supplies/away/level-cap examples. Training and equipment actions are disabled; there are no network requests, player sessions or game saves. `npm run build:preview` rebuilds the file.

v2.16.0 updates training prices and migrates saves to v3, preserving existing guardian progression, equipment and points. The [economy guide](ECONOMY.md) explains migration. Deploy the current `main` in Dokploy while retaining existing volumes; no new environment keys are required.
