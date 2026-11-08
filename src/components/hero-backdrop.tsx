import { useEffect, useState } from "react";

// Faded photos of real people recovering from injuries, shown one at a time behind the landing hero.
// Sources and licenses are listed in docs/frontend.md; the one CC BY photo is credited in the footer.
const photos = [
  { name: "01-crutches-street", position: "50% 62%" },
  { name: "02-hand-therapy", position: "35% 75%" },
  { name: "03-wheelchair-help", position: "50% 35%" },
  { name: "04-crutches-outdoors", position: "50% 40%" },
  { name: "05-patient-lift", position: "50% 40%" },
  { name: "06-leg-rehab", position: "50% 55%" },
  { name: "07-helped-down-steps", position: "50% 38%" },
  { name: "08-crutches-city", position: "50% 70%" },
  { name: "09-band-therapy", position: "50% 40%" },
];

const holdMs = 5000;

export function HeroBackdrop() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setActive(index => (index + 1) % photos.length);
    }, holdMs);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hero-backdrop" aria-hidden="true">
      {photos.map((photo, index) => (
        <img
          key={photo.name}
          className={index === active ? "is-active" : undefined}
          src={`/hero/${photo.name}.webp`}
          alt=""
          decoding="async"
          fetchPriority={index === 0 ? "high" : "low"}
          style={{ objectPosition: photo.position }}
          draggable={false}
        />
      ))}
      <div className="hero-backdrop-fade" />
    </div>
  );
}
