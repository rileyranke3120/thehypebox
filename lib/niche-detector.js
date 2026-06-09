// Niche detection for home service businesses.
// Maps detected niche to a GHL snapshot ID.
// Add entries to NICHE_SNAPSHOTS as you build niche-specific snapshots in GHL.

export const NICHE_SNAPSHOTS = {
  // Default snapshot applied to all niches that don't have their own yet.
  // Replace placeholder values with real GHL snapshot IDs as they're built.
  contractor: process.env.GHL_SNAPSHOT_ID,   // "Contractor Box" — universal fallback
  // roofing:     process.env.GHL_SNAPSHOT_ROOFING,
  // plumbing:    process.env.GHL_SNAPSHOT_PLUMBING,
  // hvac:        process.env.GHL_SNAPSHOT_HVAC,
  // painting:    process.env.GHL_SNAPSHOT_PAINTING,
  // landscaping: process.env.GHL_SNAPSHOT_LANDSCAPING,
  // cleaning:    process.env.GHL_SNAPSHOT_CLEANING,
  // concrete:    process.env.GHL_SNAPSHOT_CONCRETE,
  // flooring:    process.env.GHL_SNAPSHOT_FLOORING,
  // remodeling:  process.env.GHL_SNAPSHOT_REMODELING,
  // pest:        process.env.GHL_SNAPSHOT_PEST,
  // pool:        process.env.GHL_SNAPSHOT_POOL,
  // moving:      process.env.GHL_SNAPSHOT_MOVING,
  // electrical:  process.env.GHL_SNAPSHOT_ELECTRICAL,
};

const NICHE_KEYWORDS = {
  roofing:     ['roofing', 'roofer', 'roof repair', 'roof install', 'shingle', 'gutter'],
  plumbing:    ['plumbing', 'plumber', 'sewer', 'drain', 'water heater', 'waterheater', 'pipe'],
  hvac:        ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace', 'heat pump', 'ductwork', 'ac repair'],
  electrical:  ['electrical', 'electrician', 'electric', 'wiring', 'rewire', 'panel upgrade'],
  painting:    ['painting', 'painter', 'paint', 'staining', 'wallpaper', 'coating'],
  landscaping: ['landscaping', 'landscape', 'lawn', 'mowing', 'sod', 'sprinkler', 'irrigation', 'tree service', 'yard'],
  cleaning:    ['cleaning', 'clean', 'maid', 'janitorial', 'pressure wash', 'power wash', 'window cleaning'],
  concrete:    ['concrete', 'epoxy', 'epoxy floor', 'driveway', 'stamped', 'paving', 'patio'],
  flooring:    ['flooring', 'floor', 'hardwood', 'carpet', 'tile install', 'vinyl', 'laminate'],
  remodeling:  ['remodeling', 'renovation', 'remodel', 'general contractor', 'handyman', 'builder', 'construction'],
  pest:        ['pest', 'exterminator', 'termite', 'insect', 'rodent', 'bug control'],
  pool:        ['pool', 'spa', 'hot tub', 'swimming pool'],
  moving:      ['moving', 'mover', 'hauling', 'junk removal', 'junk'],
};

// Longer keywords must be tested before shorter ones so 'roofing' beats 'roof'.
// NICHE_KEYWORDS entries are already ordered this way.
export function detectNiche(businessName = '', email = '') {
  const text = `${businessName} ${email}`.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');

  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        return { niche, confidence: 'high', matchedKeyword: kw };
      }
    }
  }

  return { niche: 'contractor', confidence: 'low', matchedKeyword: null };
}

// Returns the best snapshot ID for a niche.
// isNicheSpecific = true means a dedicated snapshot was found (not the default fallback).
export function getSnapshotForNiche(niche) {
  const nicheId = NICHE_SNAPSHOTS[niche];
  const defaultId = NICHE_SNAPSHOTS.contractor || process.env.GHL_SNAPSHOT_ID;

  if (nicheId && nicheId !== defaultId) {
    return { snapshotId: nicheId, isNicheSpecific: true };
  }
  return { snapshotId: defaultId, isNicheSpecific: false };
}
