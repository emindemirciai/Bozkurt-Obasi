# WebGL Docker yayını

Önce `Builds/WebGL` çıktısını üretin. Ardından depo kökünde:

```powershell
docker compose -f infrastructure/web/docker-compose.yml up -d --build
```

Yerel adres: `http://localhost:8080`

Dokploy'da repository build context depo kökü, Dockerfile yolu `infrastructure/web/Dockerfile` olmalıdır. Alan adı ve HTTPS Dokploy üzerinden bağlanır. Brotli dosyaları için Nginx gerekli `Content-Encoding` ve WebAssembly MIME başlıklarını gönderir.
