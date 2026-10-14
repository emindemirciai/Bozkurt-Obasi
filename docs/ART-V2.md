# Oba ve savaş görselleri / Settlement and battlefield artwork

## Türkçe

Bu görseller, oyuncunun köyü ve kurt karakterlerini daha gerçekçi görme isteği üzerine yerleşik **image_gen** aracıyla üretildi. CLI/API yedeği kullanılmadı. Dosyalar depoda bulunur; oyun sırasında görsel üretim servisi çağrılmaz.

| Dosya (`web/assets/v2/`) | Boyut            | Kullanım                                           |
| ------------------------ | ---------------- | -------------------------------------------------- |
| `village-terrain.webp`   | 1536 × 1024      | 36 yerleşim alanının altında kalan boş oba arazisi |
| `building-tiers.webp`    | 2172 × 724, alfa | 9 bina × 3 görünüm aşaması                         |
| `wolf-roles.webp`        | 2172 × 724, alfa | Alfa, muhafız, avcı, izci ve şifacı portreleri     |
| `battlefield.webp`       | 1536 × 1024      | Obadan ayrı, pusu hikâyesine ait dağ geçidi        |

Binaların görünümü 1–2, 3–4 ve 5. seviyelerde üç farklı aşama gösterir. Atlas sütun sırası: bey otağı, oduncu, taş ocağı, su kuyusu, otlak, şifahane, ambar, gözetleme kulesi ve kurt barınağı. Çevre suru, oyun seviyesini izleyen SVG katmanında ahşap, taş ve mazgallı kale görünümüne geçer. Bina konumu bina türünden türetilmez; kayıtlı parsel koordinatından çizilir. Aynı türden birden çok bina bağımsız görünür ve taşınabilir.

Kurt portreleri anatomiyi koruyan, role göre küçük zırh veya ekipman ayrıntıları taşır. Gerçek eşya bonusları kayıtlı envanterden hesaplanır; portredeki rol kıyafeti bir eşyanın kazanıldığı anlamına gelmez. Savaş alanı, mevcut gerçekçi hayvan kesitlerini kullanır: kurtlar ve sürü sola, karşı taraftaki çakallar sağa bakar. Yürüyüş, pusu, hilal/yıldız düzenine geçiş ve çatışma, sunucunun savaş evresini izler. Hareketi azalt tercihi geçiş animasyonunu kapatır.

PNG çıktıları görüntü içeriği veya çözünürlüğü değiştirilmeden WebP `quality=90`, `method=6` ile dönüştürüldü. Saydam atlasların alfa kanalı korundu. Orijinal çıktı dosyaları yerleşik aracın `generated_images` klasöründe; çalışma dosyaları yukarıdaki depo yollarındadır.

## English

These assets were generated with the built-in **image_gen** tool in response to the request for a more realistic settlement and wolf characters. No CLI/API fallback was used. All runtime files are checked into the repository; the game does not call an image-generation service.

The building atlas has nine columns and three rows. Columns follow this order: hall, lumber mill, quarry, well, pasture, healer, storage, watchtower and wolf shelter. Rows represent levels 1–2, 3–4 and 5. The separate SVG wall layer progresses from wooden palisades to stone and crenellated fortifications. Each building is drawn at its saved plot coordinates, so duplicate producers and relocation are represented independently.

Wolf portraits preserve natural anatomy and use restrained role-specific armor or accessories. Equipped item bonuses are computed from saved inventory; clothing in a role portrait does not imply ownership of an item. Battlefield animals retain the existing realistic cutouts. Wolves and the herd face left toward right-facing attackers. Travel, ambush, crescent/star formation and combat follow server battle phases. Reduced-motion settings disable formation transitions.

The original PNG outputs were converted to WebP without content edits or resizing, using `quality=90`, `method=6` and preserving atlas alpha. Runtime assets are under `web/assets/v2/`. Original tool output IDs are recorded below for provenance.

## Üretim tarifi / Generation brief

Aşağıdaki metinler kullanılan yaratıcı ve teknik kısıtların özetidir; araç çağrılarının birebir dökümü değildir. / The following briefs summarize the creative and technical constraints, rather than claiming to be a verbatim tool transcript.

### Village terrain

```text
Original realistic cinematic overhead isometric ancient Turkic steppe village terrain.
Wide 3:2 frame, no horizon; ground fills the image. Keep the central 80 percent an
empty flat ochre-and-grass clearing with room for 36 buildings. Detailed natural
rocks and pines only around the outer edge. Warm upper-left sunlight. No buildings,
walls, animals, people, text, grid or UI. Realistic ground materials, not cartoon art.
```

Original: `exec-4201e0bf-5e8e-447a-9226-2fde9f205a90.png`.

### Building atlas

```text
Original photorealistic isometric RTS sprite atlas on transparent alpha. Exact nine
columns by three rows, wide 3:1 frame, 27 complete separate buildings. Same camera,
upper-left lighting and generous cell padding. Columns: hall, lumber, quarry, well,
pasture, healer, storage, watchtower, shelter. Row one: felt and wood. Row two:
reinforced timber and stone. Row three: fortified masonry and bronze details.
No people, labels, lettering, logos or cartoon stylization.
```

Original: `exec-1ed28983-d606-4188-8d86-eeaa8b045853.png`.

### Wolf roles

```text
Five anatomically correct full-body adult gray wolves, facing right, isolated on
transparent alpha in five equally wide columns. Role accessories: alpha in leather
and bronze, guardian with restrained iron armor, minimally equipped hunter, scout
with a small pouch, healer with a satchel. Same scale and baseline, complete ears,
muzzle, tail and paws inside each cell. Natural fur and adult proportions.
Final spacing correction: shrink the figures about 35 percent, retain at least
10 percent padding inside each cell, use the same 85 percent baseline, and avoid
any overlap between figures. No text, scenery or background.
```

Selected corrected output: `exec-5670ea63-1aea-4cd7-a727-2617cf823694.png`. The earlier crowded variant is not used.

### Battlefield terrain

```text
Realistic overhead isometric steppe ambush terrain in a wide 3:2 frame. Camera looks
down about 55 degrees, with no horizon. A dusty mountain trail runs from bottom
right to upper left. Keep the central 65 percent traversable. Rocks, pines and
scrub along the edges; dry riverbed on the left. Storm shadows and warm golden
light. No buildings, walls, people, animals, text or UI.
```

Original: `exec-80234ad5-df80-4dc3-a4cf-9765ff8894a3.png`.
