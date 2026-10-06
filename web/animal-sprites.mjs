// Local wildlife cutouts: Vite bundles each URL once; Node can also import the scene artwork.
const sprites = {
  wolf: {
    url: new URL('./assets/animals/wolf-realistic.webp', import.meta.url).href,
    crop: [48, 3, 428, 329],
    width: 64,
    baseline: 20,
  },
  jackal: {
    url: new URL('./assets/animals/jackal-realistic.webp', import.meta.url).href,
    crop: [21, 0, 471, 337],
    width: 48,
    baseline: 20,
  },
  sheep: {
    url: new URL('./assets/animals/sheep-realistic.webp', import.meta.url).href,
    crop: [53, 4, 402, 330],
    width: 28,
    baseline: 11,
  },
  cow: {
    url: new URL('./assets/animals/cow-realistic.webp', import.meta.url).href,
    crop: [31, 4, 462, 324],
    width: 32,
    baseline: 11,
  },
};

export function battleAnimal(species, scale = 1, facing = 1) {
  const sprite = sprites[species];
  if (!sprite) throw new RangeError(`Unknown battle animal: ${species}`);
  const [cropX, cropY, cropWidth, cropHeight] = sprite.crop;
  const width = sprite.width;
  const height = (width * cropHeight) / cropWidth;
  return `<g class="battle-animal" data-facing="${facing}" transform="scale(${scale * facing} ${scale})"><ellipse class="battle-animal-shadow" cy="${sprite.baseline}" rx="${width * 0.34}" ry="${width * 0.065}" fill="#243a29" opacity=".18"/><svg x="${-width / 2}" y="${sprite.baseline - height}" width="${width}" height="${height}" viewBox="${cropX} ${cropY} ${cropWidth} ${cropHeight}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image class="battle-animal-image" data-animal-kind="${species}" href="${sprite.url}" width="512" height="341"/></svg></g>`;
}
