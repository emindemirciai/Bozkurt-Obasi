# Ana Yurt: dağ eteği ve ırmak / Homeland foothill and river

## Türkçe

Ana Yurt zemini, mevcut gerçekçi bozkır görseli düzenlenerek üretildi. Irmak sağ üstte dağın eteğindeki kısa şelaleden başlar ve surların dışındaki sağ kenar boyunca akar. Alçak dağ eteği üst sınırdan sola uzanır; merkezi yerleşim alanı binalar için boş kalır.

- Yöntem: yerleşik **Imagegen**, `precise-object-edit`; API/CLI kullanılmadı.
- Düzenleme girdisi: `web/assets/v2/village-terrain.webp`.
- Oyunda kullanılan görsel: `web/assets/v2/village-terrain-river.webp`, 1440 × 980, tam opak.
- Üretim orijinali: `artifacts/terrain-art-originals/village-terrain-river.png`, 1520 × 1035. Tam Drive yedeğine dahildir; temiz kaynak ZIP'inde yalnız kullanılan WebP bulunur.
- İşleme: sadece LANCZOS ölçekleme ve kalite 84 WebP dönüştürme; yaratıcı içerik düzenlemeleri Imagegen ile yapıldı.
- Kamera üzerinde 1440 × 980 dünya koordinatlarına sabitlenir. Dış ekran boşluklarını mevcut genişleyen zemin doldurur; ırmağın konumu ekran oranıyla değişmez.
- Animasyon katmanı yalnız düşük opaklıkta su parıltısı/köpük ekler. Toprak, taşlar, sazlar, ırmak yatağı ve şelale tek gerçekçi görsele aittir. Yağmur, güneş, bulut, duraklatma ve azaltılmış hareket korunur.
- Dekorlar kaynak üretimini, yerleşim noktalarını veya savaş gücünü değiştirmez.

## English

The homeland terrain edits the existing realistic steppe plate. The river starts at a small cascade at the foot of the mountain in the upper right, then follows the outer right side of the settlement. Low foothills extend left along the top boundary while the central building ground remains open.

- Method: built-in **Imagegen**, `precise-object-edit`; no API or CLI generation.
- Edit input: `web/assets/v2/village-terrain.webp`.
- Runtime asset: `web/assets/v2/village-terrain-river.webp`, 1440 × 980, fully opaque.
- Generation original: `artifacts/terrain-art-originals/village-terrain-river.png`, 1520 × 1035, retained in the full Drive backup; the clean source ZIP includes only the runtime WebP.
- Post-processing: LANCZOS resizing and quality 84 WebP encoding only. Creative image changes were produced with Imagegen.
- Fixed to 1440 × 980 world coordinates; the existing expanding backdrop fills excess viewport space. River placement remains independent of screen aspect ratio.
- The animation overlay adds only faint water glints and foam. Ground, rocks, reeds, riverbanks and cascade belong to the realistic image. Rain, sunlight, cloud drift, pause and reduced-motion behavior are preserved.
- Decorative scenery does not alter production, building slots or battle strength.

## Final prompt / Son istem

```text
Use case: precise-object-edit.
Asset type: photorealistic terrain plate for a medieval Anatolian village game, 1440 by 980 world space; landscape aspect ratio 1.469:1.
Input image: EDIT TARGET, preserve the warm ochre dry-steppe soil, natural scrub and pine scale, realistic aerial isometric camera, lighting and huge flat clearing.
Primary request: Add natural mountain foothills along the very top boundary and a realistic river descending the far RIGHT outer boundary. The river begins in a modest rocky spring and a short cascading waterfall at the foot of the mountain in the UPPER RIGHT. Continue that low rugged rocky foothill LEFTWARD across the whole top edge, with proportionate low ridges and sparse pines. It must look like the foot of a mountain, not isolated rocks nor a huge looming mountain range.
Precise composition: Treat image as coordinates x0..1440, y0..980. Preserve an EMPTY flat diamond defined by points (720,112), (1345,477), (720,844), (95,477) for future buildings. Never depict the diamond outline. Top foothill across upper edge can fill y0..85 in the middle and y0..150 near extreme corners; all lower space near center remains flat and empty. Natural spring/cascade is around (1290,95) to (1304,152). Thin winding river (about 24 to 36 world pixels wide, realistic small river) curves from there along outer-right rim through approximately (1382,255), (1410,425), (1395,550), (1300,665), (1245,770), (1160,890), to (1135,980) and exits bottom edge. Keep its banks completely OUTSIDE the central diamond. Main right point (1345,477) remains dry land to build walls on, never in water. River follows the diagonally narrowing bottom-right side of the diamond.
Materials: detailed naturally irregular stony banks, blue-grey green reflected water, clear ripples, fine white water where dropping over rock, scattered real stones, small reeds, earthy moss close to water only. Warm muted real landscape, photogrammetry-quality convincing scale and aerial perspective. Sunlight from upper left. No illustrated outlines or painted bands.
Constraints: Preserve very large EMPTY central building ground. Preserve low oblique aerial/isometric view and no horizon/sky. No buildings, fences, walls, towers, people, animals, labels, text, logos, UI, dotted grid, roads or conspicuous path. No cartoon, polygon art, flat-color water stripe or giant waterfall. Do not mirror composition. Entire plate fully opaque.
```

## SHA-256

- Runtime WebP: 962500d38006f9a879f1a65515720b2bbd5829d76246e7f39c71811ebb9bae0e
- Original PNG: 91f7e8b666964f17d25f6fce4dc206913f3b9323fc2fc94db2bc651481e9230a
