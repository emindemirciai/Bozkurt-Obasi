# Nakama yerel geliştirme sunucusu

Bu paket WP-11'de misafir hesap, profil, arkadaşlık ve bulut kayıt testleri için kullanılır.

## Başlatma

Depo kökünde PowerShell açın:

```powershell
docker compose -f infrastructure/nakama/docker-compose.yml up -d
```

Kontrol:

- Oyun API: `http://127.0.0.1:7350`
- Nakama Console: `http://127.0.0.1:7351`
- Yerel Console kullanıcı adı/parolası: `admin` / `password`
- Yerel istemci server key: `defaultkey`

## Durdurma

```powershell
docker compose -f infrastructure/nakama/docker-compose.yml down
```

Veritabanını da tamamen silmek için yalnızca test ortamında:

```powershell
docker compose -f infrastructure/nakama/docker-compose.yml down -v
```

> `defaultkey`, `admin/password` ve yerel veritabanı şifresi canlı ortamda kullanılmayacaktır. Dokploy kurulumu sırasında güçlü secret değerleri tanımlanacaktır.
