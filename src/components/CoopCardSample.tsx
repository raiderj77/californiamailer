const sampleOffers = [
  ["CAFE", "A good morning starts nearby", "Your breakfast offer here"],
  ["PLUMBING", "Help for the unexpected", "Your service offer here"],
  ["PET CARE", "For their favorite companion", "Your welcome offer here"],
  ["LANDSCAPING", "Make room for outdoor living", "Your seasonal offer here"],
  ["AUTO CARE", "Keep the week moving", "Your maintenance offer here"],
  ["FITNESS", "Start a new local routine", "Your introductory offer here"],
  ["HOUSE CLEANING", "Come home to a fresh start", "Your first-visit offer here"],
  ["BAKERY", "Something worth sharing", "Your neighborhood offer here"],
  ["ELECTRICAL", "A brighter idea for home", "Your service offer here"],
  ["FLORIST", "Make an ordinary day special", "Your bouquet offer here"],
  ["PAINTING", "Give your space a fresh look", "Your project offer here"],
  ["BIKE SHOP", "Ready for the next ride", "Your tune-up offer here"],
  ["WINDOW CARE", "Let the light back in", "Your seasonal offer here"],
  ["BOOKSHOP", "Find your next favorite", "Your reader offer here"],
  ["APPLIANCE REPAIR", "Get back to your routine", "Your service offer here"],
  ["GARDEN SHOP", "Grow something you love", "Your planting offer here"],
];

export default function CoopCardSample() {
  return (
    <figure className="cm-card-study" aria-label="Original sample 9 by 12 inch co-op postcard with 16 equal ad slots total, eight on each side">
      <div className="cm-sample-heading"><strong>YOUR NEIGHBORHOOD, IN GOOD COMPANY.</strong><span>9 × 12 CO-OP CARD · SAMPLE ONLY</span></div>
      {[0, 1].map((side) => (
        <div className="cm-sample-side" key={side}>
          <p className="cm-side-label">{side === 0 ? "FRONT" : "BACK"} · 8 EQUAL AD SLOTS</p>
          <div className="cm-ad-grid">
            {sampleOffers.slice(side * 8, side * 8 + 8).map(([category, headline, offer], index) => (
              <div className="cm-sample-ad" data-sample-slot={side * 8 + index + 1} key={category}>
                <span>{category} · EXAMPLE {String(side * 8 + index + 1).padStart(2, "0")}</span>
                <strong>{headline}</strong><small>{offer}</small>
              </div>
            ))}
          </div>
          <div className="cm-postal-band">{side === 0 ? "CaliforniaMailer · Discover businesses close to home" : "Reserved postal area · Address and postage placement to be verified"}</div>
        </div>
      ))}
      <figcaption>Illustrative concept: 16 equal ad slots total, shown as eight per side. All ads are fictional examples, not booked businesses or live availability. Final side allocation, slot dimensions, and postal clear areas require printer approval.</figcaption>
    </figure>
  );
}
