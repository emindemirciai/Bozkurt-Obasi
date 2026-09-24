# Analiz paneli kaynak bildirimi / Analytics source notice

`services/analyze` is based on **Siteni Analiz Et / Analyze Your Site** at commit `e12cbb5` from [emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-](https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-). It is included under that project's MIT license; see [`services/analyze/LICENSE`](../services/analyze/LICENSE).

The source was copied from the committed revision. Uncommitted changes in the sibling working tree were not included. The bundled service contains the application and its standalone Docker build. Its original standalone Compose file and README files were omitted because this repository provides its own integrated deployment instructions.

`services/analyze` dizini, bağlantıdaki **Siteni Analiz Et** projesinin `e12cbb5` commit'inden alınmıştır. MIT lisansı ve telif bildirimi `services/analyze/LICENSE` dosyasında korunur. Yan projedeki commit edilmemiş değişiklikler bu kopyaya dahil edilmemiştir.

Integration changes in this repository: Docker installation uses npm ci --legacy-peer-deps for the source project's React 19/map-library peer mismatch. The login cookie follows the actual request scheme so local HTTP testing works and production HTTPS remains Secure.

Bu depodaki uyarlamalar: React 19/harita kütüphanesi peer uyuşmazlığı için Docker kurulumu --legacy-peer-deps kullanır. Giriş çerezi gerçek istek şemasına göre ayarlanır; yerel HTTP testi çalışırken üretim HTTPS'inde Secure kalır.

Additional integration changes: the login page now supports Turkish and English, the dashboard avoids a server/client hydration mismatch, and the layout uses a local system font so Docker builds do not fetch a Google font.

Ek uyarlamalar: giriş sayfası Türkçe/İngilizce oldu, panelin sunucu/istemci hydration uyuşmazlığı giderildi ve Docker derlemesinin Google font ağına bağımlılığı kaldırıldı.
