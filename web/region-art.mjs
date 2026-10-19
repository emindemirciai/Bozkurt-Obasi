/** URLs remain usable in browsers, offline bundles and Node-based artwork checks. */
export const REGION_ART = Object.freeze({
  homeland: new URL('./assets/v2/village-terrain.webp', import.meta.url).href,
  spring: new URL('./assets/v2/region-spring.webp', import.meta.url).href,
  meadow: new URL('./assets/v2/region-meadow.webp', import.meta.url).href,
  highland: new URL('./assets/v2/region-highland.webp', import.meta.url).href,
  ruins: new URL('./assets/v2/region-ruins.webp', import.meta.url).href,
});

export function regionArtwork(regionId) {
  return REGION_ART[regionId] ?? REGION_ART.homeland;
}
