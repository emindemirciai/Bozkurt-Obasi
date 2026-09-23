# WP-11 — Çevrim İçi Temel

## Kapsam

- Resmî Nakama Unity SDK 3.21.1 paket bağımlılığı
- İsteğe bağlı misafir cihaz hesabı
- Unity WebGL için kalıcı yerel GUID cihaz kimliği
- Kullanıcı adı ve görünen ad güncelleme
- Kullanıcı adıyla arkadaşlık isteği
- Arkadaşlık durumlarını listeleme
- Yerel kayıt dosyasını Nakama Storage Engine üzerine yükleme
- Yalnızca daha yeni bulut kaydını yerel cihaza indirme
- Nakama kapalı olduğunda tek oyunculu oyunun çalışmaya devam etmesi
- PostgreSQL 16 ve Nakama 3.39.0 için yerel Docker Compose
- Ana menüde çevrim içi hesap/bulut kayıt penceresi
- Bulut kayıt birleştirme politikası için Edit Mode testleri

## Yerel test

```powershell
.\tools\server\start-nakama.ps1
```

Unity ana menüsünde **Çevrim İçi** düğmesini açın. Yerel Nakama Console adresi `http://127.0.0.1:7351` ve geliştirme girişi `admin / password` şeklindedir. Bu bilgiler yalnızca yerel geliştirme içindir.

## Bilinen sınır

WP-11 gerçek zamanlı socket, sohbet, arkadaşlık isteğini kabul/ret, kamp ziyareti ve ortak görev içermez. Bunlar sonraki çevrim içi iş paketlerine ayrılmıştır.
