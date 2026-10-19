# Bölge görselleri / Region artwork

## Türkçe

Dört sefer bölgesi için ayrı, gerçekçi bozkır peyzajları üretildi. Bunlar gerçek konum fotoğrafları değil, oyuna özel yapay zekâ üretimi çevre görselleridir. Aynı günışığı, sıcak taş/kahverengi ve bozkır yeşili paleti korunur; yazı, arayüz, logo, insan ve modern yapı içermez.

Üretim yöntemi: imagegen becerisinin varsayılan yerleşik aracı, `image_gen.imagegen`. Her bölge ayrı çağrıyla, yeni görsel olarak üretildi; CLI veya API anahtarı kullanılmadı. Dört özgün PNG ayrı ayrı görsel olarak incelendi.

Üretim varlıkları: aşağıdaki WebP dosyaları. Her biri tam kareyi koruyarak yalnızca boyut/biçim optimizasyonundan geçirildi: 1672 × 941 RGB PNG → 1440 × 810 RGB WebP, kalite 82, yöntem 6. Öğe ekleme/çıkarma, renk düzenleme, kolaj veya yaratıcı rötuş yapılmadı. Koyu okunurluk katmanı ve responsive kırpma uygulama tarafındadır; görsele işlenmedi.

Orijinal PNG kopyaları yerel yedekleme için `artifacts/region-art-originals/` altında tutulur. Ürün kodu aşağıdaki dört WebP dosyasını kullanmalıdır.

## English

Four separate realistic steppe landscapes were generated for the journey regions. They are AI-generated game environments, rather than photographs of real locations. They share daylight, warm stone/brown and muted steppe-green colors, without text, interface, logos, people or modern structures.

Generation method: the imagegen skill’s default built-in `image_gen.imagegen` tool. Each region received its own fresh-image call; no CLI or API key was used. All four original PNG outputs were inspected visually.

The production assets below received format/size optimization only, keeping the full scene: 1672 × 941 RGB PNG → 1440 × 810 RGB WebP, quality 82, method 6. No objects were added/removed, colors adjusted, images composited or creative retouching applied. Dark readability overlays and responsive cropping belong to the application, not the artwork.

Original PNG copies are retained locally under `artifacts/region-art-originals/`. Product code should consume the following four WebP assets.

## Dosyalar / Files

| Bölge / Region                   | Varlık / Asset                       | Boyut / Dimensions | Bayt / Bytes | SHA-256                                                            |
| -------------------------------- | ------------------------------------ | ------------------ | -----------: | ------------------------------------------------------------------ |
| Su Gözü / Wellspring             | `web/assets/v2/region-spring.webp`   | 1440 × 810         |       369614 | `a49da50edba8131c6e0f04020230649d2cfa6ff50c022a9361a2a9f17cf55d56` |
| Şifalı Çayır / Healing Meadow    | `web/assets/v2/region-meadow.webp`   | 1440 × 810         |       333298 | `7299524e448c1224da23f6426f2f1cc7b4d8a02f8b1355c77a17b2f586b1be82` |
| Yüksek Otlak / High Pastures     | `web/assets/v2/region-highland.webp` | 1440 × 810         |       273618 | `af80f133ccd8a59e07cde6b043643fb751b4cf5a445880b95faf30f4b565cdbc` |
| Kadim Kalıntılar / Ancient Ruins | `web/assets/v2/region-ruins.webp`    | 1440 × 810         |       290640 | `7c2934c7f31f046e317ea4a91dae28eb91965c77d00cb2129dd6e62436efe283` |

## Ortak nihai prompt / Shared final prompt

Each final prompt is this shared block followed by its region-specific block below. / Her nihai prompt, bu ortak blok ile aşağıdaki ilgili bölge bloğunun birleşimidir.

```text
Use case: historical-scene.
Asset type: landscape background artwork for a browser strategy game's exploration region card.
Style/medium: highly realistic cinematic environment art with physically plausible natural textures, historical Anatolian and Central Asian steppe atmosphere. Match the same cohesive visual style across this region collection: grounded, mature, realistic game art rather than a cartoon or flat illustration.
Composition/framing: wide 16:9 landscape, naturally composed from an elevated human-eye viewpoint; a clear memorable central landscape feature reads well at card size, with foreground texture, middle distance, and atmospheric distant terrain. Keep the main subject safely within the center so responsive cards remain recognizable.
Lighting/mood: natural warm daylight, calm and inviting, balanced exposure and detailed shadows; no artificial dark overlay.
Color palette: earthy browns, warm stone, muted steppe greens, restrained sky blue. Realistic material color.
Constraints: no text, labels, interface, lettering, logos, watermark, people, modern buildings, modern machinery, fantasy architecture or cartoon rendering. Opaque full scene, not a cutout.
```

### Su Gözü / Wellspring

```text
Primary request: Wellspring / Su Gözü. An authentic natural spring emerging between weathered pale-brown rocks in an Anatolian steppe valley, crystal clear shallow water forming a small creek, a few grasses and reeds along the wet edge. The small rocky spring and winding water are the unmistakable central feature; gently rolling dry-green steppe beyond. No built fountain, no waterfall dominating the scene.
```

### Şifalı Çayır / Healing Meadow

```text
Primary request: Healing Meadow / Şifalı Çayır. A sunlit medicinal-herb meadow in the Anatolian and Central Asian steppe, rich green and golden grasses mixed with natural small wildflowers and herb patches. The meadow is the unmistakable central feature, with tactile flowers in the near foreground and softly rolling open hills beyond. Restrained purple, white, and yellow blooms, natural botanical scale, no ornamental garden rows.
```

### Yüksek Otlak / High Pastures

```text
Primary request: High Pastures / Yüksek Otlak. An expansive upland pasture at the foothills of a dramatic mountain range, grassy steppe-green alpine grazing slopes and brown rocky outcrops, distant layered mountains under a clear natural sky. The open high pasture and distant mountain silhouettes are the unmistakable central feature. Broad empty landscape, no village, no livestock, no dramatic magical peaks.
```

### Kadim Kalıntılar / Ancient Ruins

```text
Primary request: Ancient Ruins / Kadim Kalıntılar. Weathered ancient stone ruins standing quietly in the Anatolian steppe: low crumbling stone walls, a few broken upright pillars and an eroded stone arch, partially reclaimed by dry grasses. The old stone remains are the unmistakable central feature, with rolling steppe hills behind. Plausible ancient regional masonry and grounded archaeology, no pristine palace, no glowing elements, no modern structures.
```
