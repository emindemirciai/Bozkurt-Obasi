# Ana sayfa görseli / Homepage artwork

## v1.2.4 — 2026-09-28

**TR:** Mevcut ana sayfa resmi, yerleşik `image_gen` aracıyla düzenlendi. Beş kurt obanın önünde, sürüyü çevreleyen ve çakallara doğru açılan doğal bir hilal oluşturur. Dağlar, göl, gün batımı, oba ve karşıdaki çakallar korunmuştur. Tüm kurtlar sağdaki çakallara bakar. Nihai dosya [`web/assets/hero-bozkurt.webp`](../web/assets/hero-bozkurt.webp), 1672×941 piksel, 457.788 bayttır. PNG çıktısı yalnızca WebP biçimine kodlandı; yeniden boyutlandırma veya kırpma yapılmadı. Önceki resim v1.2.3 Git etiketinde ve kaynak ZIP'inde bulunur.

**EN:** Edited the existing hero using the built-in `image_gen` tool. Five wolves form a natural crescent in front of the camp, protecting the herd with the opening toward the jackals. The mountains, lake, sunset, camp and opposing jackals are retained. Every wolf faces the jackals on the right. The final asset is [`web/assets/hero-bozkurt.webp`](../web/assets/hero-bozkurt.webp), 1672×941 pixels, 457,788 bytes. The generated PNG was encoded to WebP without resizing or cropping. The earlier artwork remains in the v1.2.3 Git tag and source ZIP.

## Kullanılan tam istem / Exact editing prompt

```text
Use case: precise-object-edit.
Asset type: the landscape hero artwork for the Bozkurt Obası game website.
Input image 1 is the EDIT TARGET, not merely a style reference.
Primary request: rearrange the existing guardian wolves into a clearly readable crescent-shaped defensive formation in front of the nomadic camp, protecting the sheep. Keep the beautiful original background.
Change only the wolves and the small foreground ground areas needed to reposition them. Preserve the original camera, wide composition and near-16:9 aspect ratio, snowy mountains, sunset and sun, clouds, valley, distant river and lake, pine tree, camp yurts, watchtower, wooden fence, herd and jackals as closely as possible. Retain the same realistic painterly style, light and colors.
Place the wolves as one coherent crescent arc immediately outside the camp and in front of the herd. The back of the crescent is to the left, nearer the camp; its upper and lower tips extend toward the right, toward the jackals. Spread the five existing wolves along the curve with enough visible ground between them to make the crescent unmistakable. Use natural perspective and realistic wolf sizes, not five overlapping giant wolves. The largest wolf can anchor the near tip, with progressively smaller wolves along the far side. All five wolves' bodies and faces are directed toward the approaching jackals on the right, never toward the viewer or the sheep. The sheep remain protected behind the arc and face toward the jackals.
The wolves must stand alert and ready on the existing grassy/rocky ground, with convincing paws, shadows and fur. No literal crescent icon, no drawn formation line, no added moon, no flags, no extra animals, no text, no watermark, no new background. Preserve the entire original scene without cropping or reframing.
```

TR/EN arayüz aynı görseli kullanır; mobilde doğal en-boy oranı, masaüstünde tüm resmi gösteren `object-fit: contain` korunur. / Both interface languages share the same asset; mobile retains its native ratio and desktop keeps the whole image visible with `object-fit: contain`.
