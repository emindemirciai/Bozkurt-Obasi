# Gerçekçi savaş hayvanları / Realistic battlefield animals

## Türkçe

Savaş meydanındaki kurt, çakal, koyun ve büyükbaş görselleri, yerleşik `image_gen` aracıyla bu proje için üretildi. Doğal yetişkin anatomisi, gerçekçi kürk ve yaklaşık 30° yukarıdan bakış kullanıldı. Dört hayvan da sağa bakacak şekilde üretildi; savaşta kurtlar ve sürü sola, çakallar sağa çevrilir. Böylece savunmacılar saldırganlara bakar.

Bu varlıklar yalnızca savaş sahnesinde kullanılır. Köy çizimleri, logo ve e-posta görselleri bu değişiklik kapsamında değildir. Hilal/yıldız düzeni, can göstergeleri ve savaş animasyonları mevcut sahneyle birlikte çalışır. Dosyalar yereldir; çalışma sırasında görsel üretimi veya harici görsel servisi çağrısı yapılmaz.

Saydam PNG kaynakları `web/assets/animals/` altında korunur. Tarayıcı, aynı klasördeki WebP dosyalarını yükler. PNG kaynaklar 1536 × 1024 RGBA; WebP sürümler 512 × 341 boyutundadır. Pillow ile LANCZOS küçültme ve WebP `quality=90`, `method=6`, `exact=True` ayarları kullanıldı. Arka planın alfa kanalı korundu; çalışma dosyalarının toplamı **197.544 bayt (yaklaşık 193 KiB)**. Saydam kenar boşluklarını hesaba katan sahne kırpma ve ölçek verileri [animal-sprites.mjs](../web/animal-sprites.mjs) dosyasında bulunur. PNG kaynakları yeniden boyutlandırma veya farklı çözünürlükler için kullanılabilir.

## English

The wolf, jackal, sheep and cow cutouts were generated for this project with the built-in `image_gen` tool. They use natural adult anatomy, realistic fur and an elevated camera angle of approximately 30°. All four animals were generated facing right; the battlefield flips wolves and the herd to face left while jackals face right. The defenders therefore look toward the attackers.

These assets are used only in the battlefield. Village drawings, the logo and email artwork are outside this change. The crescent/star formation, health bars and battle animations remain part of the existing scene. All files are local; rendering does not call an image generator or an external image service.

Transparent PNG originals are retained in `web/assets/animals/`. Browsers load the WebP files in the same directory. Original PNGs are 1536 × 1024 RGBA; runtime WebPs are 512 × 341. Pillow used LANCZOS downscaling and WebP settings `quality=90`, `method=6`, `exact=True`. Alpha transparency was preserved; the four runtime files total **197,544 bytes (approximately 193 KiB)**. Scene crop and scale metadata, which accounts for transparent margins, is stored in [animal-sprites.mjs](../web/animal-sprites.mjs). Keep the PNG originals for resizing or alternate resolutions.

| Hayvan / Animal | Kaynak / Original      | Tarayıcı / Runtime      | WebP bayt / bytes |
| --------------- | ---------------------- | ----------------------- | ----------------: |
| Kurt / Wolf     | `wolf-realistic.png`   | `wolf-realistic.webp`   |            46,680 |
| Çakal / Jackal  | `jackal-realistic.png` | `jackal-realistic.webp` |            54,492 |
| Koyun / Sheep   | `sheep-realistic.png`  | `sheep-realistic.webp`  |            48,896 |
| Büyükbaş / Cow  | `cow-realistic.png`    | `cow-realistic.webp`    |            47,476 |

## Kullanılan tam istemler / Exact generation prompts

İstemler aşağıda değiştirilmeden korunur. Kurt için ilk üretimin ardından, aynı hayvanı koruyan bir alfa temizleme düzenlemesi yapıldı. / The prompts below are preserved verbatim. The wolf received an alpha cleanup edit after its initial generation, preserving the same animal.

<details>
<summary>Kurt: ilk üretim / Wolf: original generation</summary>

```text
Use case: photorealistic-natural
Asset type: transparent realistic RTS game animal sprite for Bozkurt Obası battlefield
Primary request: one single lifelike adult Eurasian gray wolf, complete full body, standing alert on four paws and facing RIGHT (head at right, tail extending left).
Scene/backdrop: genuinely transparent alpha background, isolated clean cutout, no ground or scene.
Subject: natural adult wolf anatomy; long slender legs, lean athletic torso, strong shoulders, long bushy lowered tail, realistically proportioned pointed muzzle, small amber eyes and upright ears. Dense realistic gray, charcoal, cream and subtle brown fur, crisp individual hairs and natural paws.
Style/medium: lifelike wildlife photography with realistic game production rendering, physically plausible natural anatomy, no stylization.
Composition/framing: elevated three-quarter isometric game camera about 30 degrees down, mostly side silhouette, all four feet, ears and complete tail visible; single centered animal fills about 85 percent of image width, small generous transparent margins. Readable coherent silhouette when rendered small in an RTS battlefield.
Lighting/mood: neutral soft daylight, natural realistic surface detail, alert calm guardian pose.
Constraints: ONLY ONE wolf. Actual transparent pixels outside animal. No ground, platform, base, scenic background, painted shadow, checkerboard, letters, UI, border, watermark, human props or collar. No cartoon, toy, plush, Disney, low-poly, oversized eyes, giant head, exaggerated paws or simplified geometric body.
```

</details>

<details>
<summary>Kurt: alfa temizleme / Wolf: alpha cleanup edit</summary>

```text
Use case: background-extraction
Asset type: transparent photorealistic gray wolf RTS sprite
Edit target: provided wolf image. Keep exactly the same one wolf, its lifelike natural anatomy, gray fur, right-facing head, alert stance, all paws and tail, same size and framing. Change ONLY the alpha cutout outside the wolf. Remove the entire dark/gray gradient halo, fog, glow, backdrop and shadow around the silhouette and between the legs. There must be absolutely no opaque or partly opaque haze in the empty surrounding region. Empty region must be true alpha 0 transparent, wolf body must be true opaque alpha 255 except only fine fur silhouette edge antialiasing. No scene, no ground, no platform, no background, no fake checkerboard. A crisp isolated genuine alpha cutout suitable for compositing over a green RTS battlefield, preserving realistic fur edge detail.
```

</details>

<details>
<summary>Çakal / Jackal</summary>

```text
Use case: photorealistic-natural.
Asset type: a single transparent game animal sprite for a browser RTS battlefield.
Primary request: Create one anatomically realistic adult golden jackal (Canis aureus), full body, isolated on a truly transparent background. Natural wildlife photographic realism suitable for a realistic strategy game, with crisp readable silhouette and detailed natural fur.
Subject: A slender, lean golden jackal, visibly smaller and lighter framed than a gray wolf, long slender legs, pointed narrow muzzle, upright triangular ears, brown eyes, natural golden tan and grizzled black mottled fur, natural proportioned head, bushy tail held low behind it. This must be the actual golden jackal species, not a fox and not a recolored wolf.
Composition/framing: Three-quarter elevated isometric game camera, around 30 degrees looking down, the animal in an alert forward poised stance facing RIGHT, head toward the right and tail toward the left. A slight forepaw extension gives motion but all four legs must be anatomically clear and recognizable. Entire animal visible including every foot and tail, occupying approximately 85 percent of image width, with a small clean transparent margin. One animal only.
Lighting: Neutral natural daylight, lifelike texture, clean soft self-shadowing.
Constraints: Actual transparent alpha outside the animal. No scene, ground, pedestal, base, cast ground shadow, decorative background, checkerboard pixels, text, watermark, UI, border, additional animal, clipping or collage. No cartoon, toy, plush, Disney, exaggerated cute face, huge eyes, vector shapes, low polygon stylization. Preserve realistic anatomy.
```

</details>

<details>
<summary>Koyun / Sheep</summary>

```text
Use case: photorealistic-natural. Asset type: transparent full-body animal cutout for a realistic browser RTS battlefield. Create ONE lifelike adult Anatolian domestic sheep, natural compact body covered with detailed cream/off-white curly wool, realistic narrow sheep face, small dark eyes, subtle floppy ears, four slender legs and cloven hooves, no horns. Standing calmly but alert. Elevated three-quarter side view, camera roughly 30 degrees above the ground, head pointing to the RIGHT and tail to the LEFT; right flank and a little of the front are visible. Entire animal including every hoof and tail must fit inside the image. Subject centered, approximately 85 percent of canvas width, modest transparent margin. Natural soft daylight from upper left, realistic anatomical proportions, finely resolved wool texture, crisp silhouette readable as a small strategy game sprite. Truly transparent alpha background; NO ground, landscape, base, platform, cast shadow, text, symbols, UI, extra animal, frame, checkerboard pattern or backdrop. No cartoon, polygon art, chibi, plush, toy, oversized head or oversized eyes. Match a grounded wildlife photograph or photorealistic game render, not an illustration.
```

</details>

<details>
<summary>Büyükbaş / Cow</summary>

```text
Use case: photorealistic-natural. Asset type: genuinely transparent full-body animal cutout for a realistic browser strategy battlefield. ONE lifelike Anatolian brown cow, natural adult cattle anatomy and proportions, four distinct sturdy legs with cloven hooves, realistic medium-brown coat with subtly darker neck, small natural eyes, rounded muzzle, short natural horns and a hanging thin tail. Calm alert stance. Elevated three-quarter side view, camera about 30 degrees down; the cow looks RIGHT, head on the RIGHT and tail on the LEFT. Full animal including ears horns hooves tail stays inside the canvas; subject centered and about 85 percent of image width. Neutral soft daylight from upper left, crisp realistic fur/leather details, believable anatomy, readable clean silhouette for a small RTS sprite. The entire area outside the animal MUST be zero-alpha transparency, including between legs. NO ground, scenery, shadow, shadow halo, vignette, smoke, glow, gradient, beige or black surround, painted background, checkerboard pattern, base, frame, text, letters, props or extra animals. Only the isolated animal. Photorealistic game render or wildlife photo, never cartoon, chibi, toy, low-poly or illustrated mascot. Keep the head and eyes proportionate.
```

</details>
