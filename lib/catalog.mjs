export const CATEGORIES = ['All pieces', 'Full outfits', 'T-shirts', 'Shirts', 'Knitwear', 'Jackets', 'Dresses', 'Trousers'];
export const garments = [
  ['clay-full-outfit', 'The complete look', 'Full outfits', 'Clay / Charcoal', 'Collared shirt + tailored trousers', 'complete two-piece outfit: a plain terracotta long-sleeve collared shirt buttoned closed and tucked into dark charcoal straight-leg tailored trousers, both worn together'],
  ['ivory-tee', 'The everyday tee', 'T-shirts', 'Chalk', 'Cotton jersey · Relaxed fit', 'plain, unprinted ivory cotton crew-neck short-sleeve T-shirt with no logo, worn on its own'],
  ['ink-shirt', 'After hours', 'Shirts', 'Ink', 'Cotton · Clean collar', 'charcoal long-sleeve collared shirt, buttoned closed and worn on its own'],
  ['clay-overshirt', 'Studio overshirt', 'Shirts', 'Clay', 'Cotton twill · Two pockets', 'terracotta long-sleeve overshirt with two chest pockets, buttoned closed'],
  ['sage-knit', 'Soft structure', 'Knitwear', 'Sage', 'Rib knit · Crew neck', 'sage ribbed crew-neck sweater, worn on its own'],
  ['navy-polo', 'Weekend polo', 'T-shirts', 'Midnight', 'Cotton piqué · Short sleeve', 'navy short-sleeve polo with a three-button collar, worn on its own'],
  ['oat-cardigan', 'Sunday cardigan', 'Knitwear', 'Oat', 'Textured knit · V neck', 'oatmeal V-neck cardigan with brown buttons, buttoned closed'],
  ['indigo-jacket', 'Blue hour', 'Jackets', 'Indigo', 'Denim · Trucker cut', 'indigo denim trucker jacket with two flap pockets, buttoned closed'],
  ['sand-blazer', 'Off-duty tailoring', 'Jackets', 'Sand', 'Linen · Single breasted', 'sand linen blazer with notched lapels, buttoned closed'],
  ['black-dress', 'Evening form', 'Dresses', 'Charcoal', 'Midi · Sleeveless', 'charcoal sleeveless midi dress with a square neckline and gently flared skirt'],
  ['rust-dress', 'Terrace dress', 'Dresses', 'Terracotta', 'Linen · Short sleeve', 'terracotta short-sleeve midi shirt dress with a waist tie, buttoned closed'],
  ['stone-trousers', 'Easy pleats', 'Trousers', 'Stone', 'Tailored · Wide leg', 'stone high-waisted wide-leg pleated trousers'],
  ['dark-jeans', 'Everyday indigo', 'Trousers', 'Dark wash', 'Denim · Straight leg', 'dark indigo straight-leg jeans with a clean hem and no distressing'],
].map(([id, name, category, color, detail, description]) => ({ id, name, category, color, detail, description, image: `/garments/${id}.webp` }));

export function garmentPrompt(category, description = 'garment shown') {
  const area = category === 'Full outfits' ? 'entire outfit, both the top and trousers together,' : category === 'Dresses' ? 'outfit' : category === 'Trousers' ? 'lower body garment' : 'upper body garment';
  return `Substitute the ${area} completely with the ${description} in the reference image. Replace all logos, lettering and graphics from the original clothing with the reference garment’s design.`;
}

export function framingTip(category) {
  if (category === 'Full outfits') return 'Step back until your head, torso, waist and feet are all visible. Keep both the shirt and trousers in frame throughout the fitting.';
  return ['Dresses', 'Trousers'].includes(category)
    ? 'Step back until your waist, legs and feet are visible. A full-length view works best.'
    : 'Keep your head, shoulders and waist in frame. Start with one light layer and even lighting.';
}
