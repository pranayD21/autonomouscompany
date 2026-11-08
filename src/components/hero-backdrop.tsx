// Faded, slowly scrolling strip of photos behind the landing hero.
// Photos are CC0 (StockSnap, rawpixel); sources are listed in docs/frontend.md.
const photos = [
  "01-phone-call",
  "02-ankle-cast",
  "03-comforted",
  "04-wheelchair-consult",
  "05-paperwork",
  "06-worried-consult",
  "07-cane",
  "08-waiting",
  "09-rehab",
  "10-frustrated",
  "11-reassurance",
  "12-head-in-hand",
];

export function HeroBackdrop() {
  // The list renders twice so the track can loop seamlessly at -50%.
  const strip = [...photos, ...photos];
  return (
    <div className="hero-backdrop" aria-hidden="true">
      <div className="hero-backdrop-track">
        {strip.map((name, index) => (
          <img key={index} src={`/hero/${name}.webp`} alt="" width={960} height={640} decoding="async" loading={index < 3 ? "eager" : "lazy"} draggable={false} />
        ))}
      </div>
    </div>
  );
}
