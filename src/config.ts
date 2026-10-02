/**
 * Every tunable number for the Proxima test build lives in this file.
 * Game rules read these values; they are not scattered through the code.
 */
export const CONFIG = {
  calendar: {
    startYear: 2460,
    weeksPerYear: 52,
  },

  map: {
    width: 60,
    height: 40,
    minStartDistance: 8,
    visionRadius: 2,
    cityVision: 2,
  },

  /** Damage each turn a unit spends on hostile climate (not a map stripe). */
  exposure: {
    damagePerTurn: 5,
  },

  economy: {
    creditsPerPopulation: 1,
    creditsFlatPerCity: 2,
    rushCreditPerProductionPoint: 1,
    rushMinimumCredits: 10,
    /** Stockpile spent per production point still needed, on top of the credit price. */
    rushMineralsPerPoint: 1,
    rushNutrientsPerPoint: 1,
    rushEnergyPerPoint: 1,
    /** Energy to run a city, and extra energy for each worked improvement. */
    cityEnergyUpkeep: 1,
    improvementEnergy: 1,
  },

  city: {
    minDistance: 4,
    startingPopulation: 1,
    workRadius: 2,
    baseMinerals: 2,
    baseNutrients: 1,
    baseEnergy: 1,
    baseResearch: 1,
    nutrientsPerPop: 1,
    growthThreshold: 8,
    maxPopulation: 10,
    starveTurns: 3,
    militiaDefense: 2,
    militiaHp: 8,
    /** Extra defense multiplier added on top of terrain when fighting in a city. */
    cityDefenseBonus: 0.5,
  },

  terraform: {
    baseFee: 20,
    /** Multipliers on the base credit fee. Harsh biomes sit between 1.5 and 2. */
    biomeFee: {
      standard: 1,
      'thin-air': 1.5,
      scorched: 1.6,
      toxic: 1.75,
      frozen: 2,
    } as Record<string, number>,
    /** Base length of each project, in the worker's turns. */
    baseTurns: {
      'plant-trees': 4,
      farm: 3,
      mine: 6,
      solar: 5,
      road: 2,
      atmosphere: 8,
    } as Record<string, number>,
    /**
     * Percent of base time remaining at each terraformer tech level.
     * Level 1 is the test-build salvage former. 2 and 3 are later Verdantia techs.
     */
    techSpeedPercent: {
      1: 100,
      2: 70,
      3: 50,
    } as Record<number, number>,
    /** Energy spent from the stockpile when a project starts. */
    energyCost: {
      'plant-trees': 2,
      farm: 2,
      mine: 4,
      solar: 3,
      road: 1,
      atmosphere: 6,
    } as Record<string, number>,
  },

  social: {
    matchingBonus: 0.1,
    switchCost: 100,
    stabilityHitTurns: 5,
    /** Yield and credit multiplier while a stability hit is active: 1 - penalty. */
    stabilityYieldPenalty: 0.2,
  },

  combat: {
    /** Added to the defender before the (1 + mod) multiplier. Negative favors the attacker. */
    terrainMod: {
      grass: -0.1,
      forest: 0.35,
      rocky: 0.15,
      highlands: 0.25,
      ridge: 0.55,
      canyon: 0.2,
      coast: 0,
      toxic: 0.1,
      'alien-growth': 0.25,
      scorched: -0.15,
      dunes: -0.1,
      lava: 0,
      'thin-air': 0.05,
      'frozen-plain': -0.1,
      'ice-ridge': 0.5,
      mountain: 0.75,
      'hot-sea': 0,
      'temperate-sea': 0.05,
      'frozen-sea': 0.1,
    } as Record<string, number>,
    /** Winner loses this fraction of max hp times (1 - odds), minimum 1. */
    winnerDamageFactor: 0.5,
    bombardmentCityDamage: 4,
  },

  peace: {
    /** Faction personality sets the base quiet turns before that AI will attack. */
    byAggression: {
      'very-aggressive': 8,
      normal: 12,
      easy: 16,
    } as Record<string, number>,
    /** Global difficulty stretches or shortens every rival's window. */
    difficultyAdjust: {
      easy: 4,
      normal: 0,
      'very-aggressive': -4,
    } as Record<string, number>,
    minimum: 4,
  },

  ai: {
    oddsThreshold: {
      cautious: 0.62,
      measured: 0.48,
      bold: 0.3,
    } as Record<string, number>,
    /** Added to the personality odds threshold. Higher means a more cautious attack. */
    oddsAdjust: {
      easy: 0.04,
      normal: 0,
      hard: -0.06,
      brutal: -0.12,
    } as Record<string, number>,
    /** Extra military units each rival wants, beyond one garrison per city. */
    militaryExtra: {
      easy: 3,
      normal: 4,
      hard: 6,
      brutal: 8,
    } as Record<string, number>,
    /** How many cities the AI tries to found before it stops asking for colony pods. */
    cityTarget: {
      expansionist: 5,
      balanced: 3,
      builder: 2,
    } as Record<string, number>,
    cityTargetAdjust: {
      easy: -1,
      normal: 0,
      hard: 1,
      brutal: 2,
    } as Record<string, number>,
    /** Colony pods kept in the field, also capped by how many legal sites are left. */
    podCap: {
      expansionist: 1,
      balanced: 1,
      builder: 1,
    } as Record<string, number>,
    /** Added to every rival's attack chance once the peace window is over. Easy waits. */
    aggressionOdds: {
      'very-aggressive': 0,
      normal: 0,
      easy: 0.08,
    } as Record<string, number>,
  },

  scavenger: {
    chance: 0.18,
    searchArrayBonus: 0.12,
    debrisBonus: 0.1,
    weights: {
      credits: 40,
      minerals: 25,
      nutrients: 15,
      research: 12,
      unit: 8,
    } as Record<string, number>,
    amounts: {
      credits: 15,
      minerals: 8,
      nutrients: 6,
      research: 20,
    } as Record<string, number>,
  },

  techBonuses: {
    governanceCredits: 1,
    biologyNutrients: 1,
    edibleNutrients: 1,
    juryEnergy: 1,
    medicineHeal: 1,
    cityHeal: 1,
    formerLevelAdvanced: 2,
    formerLevelMaster: 3,
    foundryMinerals: 1,
    mineMinerals: 1,
    rationNutrients: 1,
    geneNutrients: 1,
    soilNutrients: 1,
    solarEnergy: 1,
    gardenNutrients: 1,
    gardenEnergy: 1,
    archiveResearch: 1,
    clinicHeal: 1,
    ledgerCredits: 1,
  },

  starting: {
    credits: 80,
    minerals: 12,
    nutrients: 8,
    energy: 16,
    research: 0,
  },

  /** Per-turn upkeep, paid from stockpiles. Colony pods cost the most so yards cannot spam them. */
  upkeep: {
    settler: 2,
    terraformer: 1,
    scout: 0,
    military: 1,
    naval: 1,
    /** Minerals and nutrients taken from the faction stockpile, per unit, when any are stored. */
    minerals: 1,
    nutrients: 1,
  },

  autosaveEveryTurns: 10,
  logLimit: 80,
  moveDiagonalCost: 1,
  roughMoveCost: 2,

  spies: {
    recruitCost: 50,
    /** Spies are paid once. There is no per-turn upkeep. */
    maintenance: 0,
    theftCatch: 0.35,
    sabotageCatch: 0.4,
    frameCatch: 0.3,
    sweepDetect: 0.55,
    frameMemory: 25,
    caughtMemory: 30,
  },

  diplomacy: {
    warMemory: 20,
    rejectMemory: 4,
    researchShare: 0.2,
    accept: {
      peace: 0.55,
      nap: 0.45,
      alliance: 0.35,
      research: 0.5,
      exploration: 0.5,
    } as Record<string, number>,
    treatySeekerBonus: 0.2,
    traderTreatyBonus: 0.15,
    alonePenalty: 0.25,
    aggressionPenalty: 0.15,
    axisMatchBonus: 0.08,
    memoryPenaltyPerPoint: 0.005,
    /** Grievance fades by this much at the end of every round. */
    memoryDecay: 1,
    trade: {
      techValue: 70,
      traderMargin: 0.8,
      treatyMargin: 1,
      aloneMargin: 1.35,
      /** At or above this grievance, only traders still consider an uneven deal. */
      memoryRefuse: 45,
    },
  },

  events: {
    /** No event is rolled before this round. */
    minRound: 6,
    /** Chance an event is scheduled when a roll comes due. */
    chance: 0.22,
    warningChance: 0.55,
    warningLeadMin: 1,
    warningLeadMax: 3,
    gapMin: 5,
    gapMax: 11,
    flareTurns: 4,
    flareShortTurns: 1,
    flareShieldEnergy: 8,
    dustTurns: 3,
    dustYieldPenalty: 0.2,
    dustPushDamage: 2,
    seismicDamage: 4,
    seismicLightDamage: 1,
    seismicMinerals: 8,
    wreckageCredits: 28,
    wreckageMinerals: 12,
    wreckageResearch: 24,
  },

  /** The Waking Reactor: the buried ark core stirs and the terminator frays. */
  crisis: {
    startRound: 36,
    rampRounds: 24,
    maxPulseDamage: 4,
    maxYieldPenalty: 0.35,
    creditTithe: 6,
    scarChance: 0.22,
  },

  audio: {
    defaultMaster: 0.8,
    defaultMusic: 0.45,
    defaultSfx: 0.7,
    defaultAmbient: 0.25,
    /** Headroom so a full music file sits with the ambient bed. The slider is still master × music. */
    musicTrim: 0.8,
    /** Overlap at the end of a looping file so the join does not click. */
    loopCrossfadeSec: 0.45,
    /** Overlap when the playlist, the menu, or a tension sting changes tracks. */
    trackCrossfadeSec: 1.8,
    /** How long Urgent stays up after a combat or war line, then the exploration bed returns. */
    tensionHoldSec: 16,
  },

  /** Raw tile yields before improvements, social bonuses, and stability. */
  terrainYield: {
    grass: { minerals: 0, nutrients: 2, energy: 0, research: 0 },
    forest: { minerals: 0, nutrients: 2, energy: 0, research: 1 },
    rocky: { minerals: 2, nutrients: 0, energy: 0, research: 0 },
    highlands: { minerals: 1, nutrients: 1, energy: 0, research: 0 },
    ridge: { minerals: 1, nutrients: 0, energy: 0, research: 0 },
    canyon: { minerals: 2, nutrients: 0, energy: 0, research: 0 },
    coast: { minerals: 0, nutrients: 1, energy: 1, research: 0 },
    toxic: { minerals: 1, nutrients: 0, energy: 1, research: 0 },
    'alien-growth': { minerals: 0, nutrients: 1, energy: 0, research: 1 },
    scorched: { minerals: 1, nutrients: 0, energy: 1, research: 0 },
    dunes: { minerals: 0, nutrients: 0, energy: 1, research: 0 },
    lava: { minerals: 2, nutrients: 0, energy: 2, research: 0 },
    'thin-air': { minerals: 0, nutrients: 0, energy: 2, research: 1 },
    'frozen-plain': { minerals: 0, nutrients: 0, energy: 0, research: 0 },
    'ice-ridge': { minerals: 1, nutrients: 0, energy: 0, research: 0 },
    mountain: { minerals: 2, nutrients: 0, energy: 0, research: 0 },
    'hot-sea': { minerals: 0, nutrients: 0, energy: 1, research: 0 },
    'temperate-sea': { minerals: 0, nutrients: 1, energy: 0, research: 0 },
    'frozen-sea': { minerals: 0, nutrients: 0, energy: 0, research: 0 },
  } as Record<string, { minerals: number; nutrients: number; energy: number; research: number }>,

  resourceYield: {
    minerals: { minerals: 2, nutrients: 0, energy: 0, research: 0 },
    nutrients: { minerals: 0, nutrients: 2, energy: 0, research: 0 },
    energy: { minerals: 0, nutrients: 0, energy: 2, research: 0 },
    'ark-debris': { minerals: 1, nutrients: 0, energy: 0, research: 2 },
  } as Record<string, { minerals: number; nutrients: number; energy: number; research: number }>,
} as const;

export type BiomeClass = keyof typeof CONFIG.terraform.biomeFee;
export type TerraformProjectId = keyof typeof CONFIG.terraform.baseTurns;

/**
 * New-game map sizes. Medium is the original 60×40 continent and is the default.
 * Continent count and start spacing grow with the map. Other rules stay in CONFIG.
 */
export const MAP_SIZES = {
  small: { id: 'small' as const, label: 'Small', width: 42, height: 28, continents: 2, minStartDistance: 6 },
  medium: { id: 'medium' as const, label: 'Medium', width: 60, height: 40, continents: 3, minStartDistance: 8 },
  large: { id: 'large' as const, label: 'Large', width: 90, height: 60, continents: 4, minStartDistance: 12 },
};

export const MAP_SIZE_IDS = ['small', 'medium', 'large'] as const;

export type MapSizeId = (typeof MAP_SIZE_IDS)[number];

export function mapSpec(id: string | undefined) {
  if (id === 'small' || id === 'medium' || id === 'large') return MAP_SIZES[id];
  return MAP_SIZES.medium;
}
