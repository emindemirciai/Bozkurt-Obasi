import mark from '../public/brand/logo-mark.svg?raw';
// Decorative where the enclosing link/button already supplies an accessible name.
export const brandMark = mark
  .replace(/ role="img" aria-labelledby="title"/, ' aria-hidden="true" focusable="false"')
  .replace(/<title[^>]*>.*?<\/title>/, '');
export const brandName =
  '<span class="brand-name">BOZKURT <b>OBASI</b><small>AY-YILDIZ NÖBETİ</small></span>';
