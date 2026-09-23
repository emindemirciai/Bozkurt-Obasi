# Release WP-07 UI ve Şifacı Revizyonu

## Kurulum

1. Unity'yi tamamen kapatın.
2. Güncelleme ZIP'ini çıkartın.
3. İçindeki `bozkurt-obasi` klasörünü mevcut proje klasörünün üzerine kopyalayın.
4. Windows sorunca hedefteki dosyaları değiştirmeyi onaylayın.
5. Unity Hub'dan aynı `client` klasörünü açın.
6. Sahne otomatik yenilenmezse `Bozkurt > Project > Run Current Setup (WP-07 Şifacı Revizyonu)` komutunu çalıştırın.
7. `Assets/_Project/Scenes/00_Bootstrap.unity` sahnesini açıp Play'e basın.

Yeni `ProjectSettings/BozkurtWp07UiHealerRevisionSetup.complete` işaretçisi güncellenmiş sahnelerin bir kez otomatik oluşturulmasını sağlar.

## Test

- Alt kategori çubuğu ve açılır komutlar sağ alttaki olay penceresiyle çakışmamalıdır.
- `Kurt > Şifacıyı Seç` yeşil-turkuaz Şifacı Kurt'u seçmeli ve gelişim popup'ını açmalıdır.
- Bir kurdun veya sürü hayvanının canı azaldığında Şifacı otomatik yaklaşmalı ve yeşil renkte tedavi uygulamalıdır.
- Şifacı eğitimi verildiğinde popup'taki Şifacı rütbesi ve şifa gücü artmalıdır.
- `Sürü > Sürüyü Tedavi Et` tedavi gerektiren hayvan varsa 1 şifalı bitki harcamalıdır.
- Tam cana dönen birimin sağlık çubuğu gizlenmelidir.
