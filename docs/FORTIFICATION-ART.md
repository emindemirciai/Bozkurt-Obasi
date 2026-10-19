# Gerçekçi sur görselleri / Realistic fortification artwork

## Türkçe

Surlar, açık giriş kapısı ve iki nöbetçi üç gerçekçi doku kademesiyle çizilir: seviye 1–2 ahşap, 3–4 taş, 5 kale. Her kademedeki sur halkası saydamdır; köyün içini veya araziyi boyamaz. Dört köşedeki sabit kuleler mevcut gerçekçi `building-tiers.webp` atlasından çizilir ve surla birlikte görünüm değiştirir. Sabit kuleler surun dekoratif parçalarıdır; oyuncunun mevcut kule binalarını veya kayıtlarını değiştirmez, yeni savaş bonusu eklemez.

Yerleşik `image_gen.imagegen` aracı ve imagegen becerisi kullanıldı; CLI veya API anahtarı kullanılmadı. Bir ilk taslak ve yerleşim düzeltmeleri ardından son ahşap görsel, taş ve kale varyantları üretildi. Oyun koordinatlarından çizilen saydam yerleşim kılavuzu görsel üretimine referans verildi. Üç nihai PNG görsel olarak incelendi ve gerçek RGBA alfa saydamlığı doğrulandı. WebP dönüştürmesi yalnızca biçim sıkıştırmasıdır (kalite 88, yöntem 6); piksel düzenleme, arka plan silme veya yaratıcı rötuş uygulanmadı. Orijinal PNG'ler ve koordinat kılavuzu yerel tam yedeğe giren `artifacts/fortification-art-originals/` klasöründedir.

Sur, kapı ve nöbetçi parçaları SVG içinde aynı raster görselin gerçek kırpmalarıdır. Köşe kuleleri atlasın gerçek kırpmalarıdır. Hepsi tıklamayı engellemez. Ön kulenin görsel gövdesi dışa uzanır; böylece 36. arsanın artı işareti görünür kalır. Üretim görselleri ve nihai prompt zinciri aşağıdadır.

## English

Walls, the open entrance and two sentries use three realistic material tiers: timber at wall levels 1–2, stone at 3–4 and castle masonry at 5. Each perimeter image has genuine alpha transparency around and inside the walls. The four permanent corner towers use the existing realistic `building-tiers.webp` atlas and follow the wall's visual tier. They belong to the wall scenery; they neither change player-built tower records nor add a combat bonus.

Generation used the imagegen skill's built-in `image_gen.imagegen` tool, without the CLI or an API key. An initial concept and footprint corrections preceded the final timber image and its stone/castle edits. A transparent layout guide generated from game coordinates was supplied as an image reference. All three final PNGs were visually inspected and verified to contain an RGBA alpha channel. WebP conversion was format compression only (quality 88, method 6), without pixel retouching or programmatic background removal. Original PNGs and the layout guide are retained in `artifacts/fortification-art-originals/` for the full local backup.

The wall, gate and sentry elements render actual bounded crops of their raster artwork in SVG. The fixed towers render actual atlas crops. All artwork ignores pointer events. The front tower projects outward to keep plot 36's plus marker visible. Production files and the exact prompt chain follow.

## Dosyalar / Files

| Görünüm / Tier | Dosya / File                              | Boyut / Dimensions | Bayt / Bytes | SHA-256                                                            |
| -------------- | ----------------------------------------- | ------------------ | -----------: | ------------------------------------------------------------------ |
| Ahşap / Timber | `web/assets/v2/fortification-timber.webp` | 1519 × 1036 RGBA   |       175944 | `ab5efbaacb6126b1162afa0c098526ef78e259238a4c550a359bfee2ac5a9aaa` |
| Taş / Stone    | `web/assets/v2/fortification-stone.webp`  | 1518 × 1036 RGBA   |       182106 | `2a12769e11b5d0dd62ac7df695b18e8dc333d80fe0c5ce90cda85fa911cf2245` |
| Kale / Castle  | `web/assets/v2/fortification-castle.webp` | 1518 × 1036 RGBA   |       223366 | `a028f3ec0d0a6c7af5d7115fff173627f0891451ee7741a23c7a53a873d0b356` |

## Prompt zinciri / Prompt chain

The timber final edit consumes the guide-aligned timber concept; stone consumes the final timber; castle consumes the final stone. The first three calls are included to make the generation history reproducible. / Nihai ahşap düzenlemesi kılavuza oturtulan ahşap taslağı; taş nihai ahşabı; kale nihai taşı kullanır. İlk üç çağrı üretim geçmişini izlenebilir tutmak için eklenmiştir.

### Timber initial concept / İlk ahşap taslak

```text
Use case: historical-scene.
Asset type: a transparent RGBA fortification sprite for an isometric browser village builder, one complete open-centered perimeter only.
Primary request: highly realistic physically based 3D render of an early Turkic steppe village's timber palisade wall, four fixed wooden watchtowers (EXACTLY ONE at each of the four corners), one broad open entrance gate in the lower-left diagonal wall, and two small realistically proportioned human sentries standing just outside either side of this gate.
Canvas/composition: wide 3:2 landscape frame, orthographic elevated isometric camera. The perimeter is a large symmetric diamond occupying the frame. Ground contact corner centers as percentages of canvas: BACK=(50%,14%), RIGHT=(93%,52%), FRONT=(50%,90%), LEFT=(7%,52%). Four wall runs connect these four corners. The diamond's inside is COMPLETELY EMPTY and TRANSPARENT, no floor, no ground, no village buildings. Outside is also transparent. Towers rise upward from these ground corners; all tower tops and all shadows stay in-frame. Gate centered one-half of the way between LEFT and FRONT corners, opening 10% of canvas width in that diagonal wall. The wooden gate is OPEN, making a clear through passage, with an entry timber lintel and realistic open door leaves. Two sentries, one on each side outside the gate, carry spears; they must look like human soldiers, normal adult proportions, small in scale compared with architecture, with leather lamellar armour and earth-tone clothing.
Style/medium: photorealistic high-detail strategy-game building sprite, convincing weathered wood grain, bark, rope lashings, cut log ends, iron hinges, rough woven cloth, ambient occlusion, realistic contact shadow. Wooden corner towers have slender structural beams and small thatched lookout roofs. Brown timber, muted tan thatch, subtle olive fabric, dusty warm natural daylight from upper left. Low wall height so the inner village can be visible later, about one-third of watchtower height. Large broad EMPTY transparent interior.
Constraints: exactly 4 towers total and 2 people total. NO ground tile, NO landscape, NO grass base, NO background color, NO sky, NO buildings inside, NO text, NO UI, NO labels, NO watermark, NO black or colored outlines, NO cartoon look, NO plastic or toy proportions. Genuine alpha transparency in interior AND exterior. Do not paint checkerboard. No miniature tilt-shift blur, crisp material detail.
```

### Low architecture edit / Alçak mimari düzenlemesi

```text
Use case: precise-object-edit.
Edit target: supplied transparent timber fortification sprite.
Primary request: keep the EXACT four diamond wall ground-contact corners, entire ring footprint, open gate ground position, same4towers and2sentries, all realistic materials, lighting and genuine alpha transparency. SHORTEN the vertical architecture substantially while leaving all ground positions fixed. Each of the four watchtowers must be only HALF its current height, keeping their roof width the same. Each palisade wall must be only HALF its current vertical height, and gate lintel half its current height. The sentries should be about half current human height in pixels to match the new scale, same two ground points. This is a low, wide perimeter, not tall ramparts. The tower at the very back should now start around y=130 instead ofy=15, while its feet stay aty=260. All empty interior/exterior stays fully transparent; no new terrain, no ground tile, no extra objects, no text, no UI. Preserve the four original ground corners and broad empty transparent village space. Crisp realistic3Dbuilding sprite with small architecture, not cartoon.
```

### Footprint guide render / Yerleşim kılavuzu çizimi

```text
Use case: sketch-to-render.
Input1: EXACT layout target, transparent flat diagram at1440x980. Input2: material/style reference ONLY, realistic wooden fortification. Transform INPUT1 into realistic render. Do NOT copy Input2 layout or camera.
Keep every architectural footprint EXACTLY aligned with INPUT1: four corner tower feet (720,112),(1345,477),(720,844),(95,477), wall runs at same places, gate opening from(360,633)to(475,700),2sentries at(325,661),(468,744). Keep this exact tall diamond perspective and VERY SHORT towers and LOW walls. No camera change, no recentering, no movingfeet. Replace simple boxes with short timber watchtowers, same approximate occupied bounds, natural thatched canopy, believable wood joinery. Replace simplebrownwallfaces with detailed sharpened timber palisade logs, wood grain and rope, wallonly30pxhigh. Gate posts low and sameheight asguide, open wood gate leaves. Replace stickfigureguards with tiny realistic adult spear guards in leatherlamellar, NOT gigantic.
Natural daylight fromupperleft, dusty warmbrownwood andstraw, PBRrealistic materialtexture like Input2. Each toweronly~90pxhigh on1440x980canvas. Exactly4towers1gate2guards. InteriorandexteriorMUSTbe genuinely alpha transparent, no ground or baseplates. Transparentbackground with no blackpaint, no checkerboard, no fogshadows fillingemptyspace. No UI or words. Render the entire guide without clipping.
```

### Timber production ring / Üretim ahşap suru

```text
Use case: precise-object-edit.
Primary request: remove ALL FOUR roofed watchtowers from this transparent fortification sprite and replace each tower's footprint with a simple connected 90-degree corner of the same LOW timber palisade. Preserve exact same diamond perimeter, wall heights, wooden material, light, gate andtwo guards. No tower, no roofs anywhere. Need a continuous low palisade around all four corners, except existing open gate. Remove any red or yellow fringe from transparencyedges. All emptyinterior andexterior truly transparent. Do NOT move, enlarge or recenter the ring; keep original pixelscale andcanvasextent. Materialmustlookphotorealistic, retainfinewoodgrain. No groundplane, no shadowhaze, no extraobjects.
```

### Stone production ring / Üretim taş suru

```text
Use case: precise-object-edit.
Edit this transparent timber village perimeter sprite into its upgraded STONE tier. KEEP EXACT pixel positions, diamond footprint, wall height, single gate opening, two sentry ground positions, empty transparent interior/exterior, and same camera. Do not resize/reframe/recenter. There are NO corner towers in this asset, and none should be added.
Replace low timber palisade with realistic rough-cut warm limestone masonry: irregular weathered stone blocks, small joints, slight lichen, a flat heavy stone cap. Walls remain low, same silhouette and corner coordinates. Replace gate posts/lintel with realistic compact arched stone gateway in the SAME opening, open wooden doors. Upgrade the existing two human guards to simple steel/lamellar armour with muted olive cloaks, spears, natural adult proportions, same sizes and positions. Detailed PBR historical strategy-game art, naturaldaylight, tactile stone and timber, no vector/cartoon lines.
IMPORTANT: output genuine alpha transparency; no solidground, no cloudyshadowhaze, no red/yellow outline fringe, no backgroundpaint. Preserve broad emptyvillageinterior. Exactly1gate,2guards,0towers. No text orUI.
```

### Castle production ring / Üretim kale suru

```text
Use case: precise-object-edit.
Edit the supplied transparent stone village perimeter sprite into its final CASTLE tier. Preserve EXACT same diamond footprint, ground corner and gate coordinates, canvas framing, two small human guards and their ground positions, low wallheight, and empty transparency. Do not move,resize,recenter any architecture. There are NO towers in this asset; add none.
Upgrade existing limestone to finely built weathered grey-brown fortress masonry, subtle thicker buttresses, a low crenellated parapet on top of each wall. Compact impressive stone gatehouse integrated into SAME opening, with modest crenellations, open iron-banded solid oak door leaves, delicate bronze hardware. Two existing sentries wear realistic steel lamellar and muted forest-green cloaks with spears, same scale. Natural daylight and truthful stoneblocktextures. Mature realistic strategy game sprite, notcartoon, noplastics.
Keep all components in their original coordinates. Emptyinteriorandexterior are genuinely alpha transparent. No painted floor or ground, no atmosphericblack/cloudyfringe, no outline, no labels/text/UI/watermark. Exactly1openpassage,2guards,0towers. No extra people or objects.
```
