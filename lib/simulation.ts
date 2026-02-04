export interface SimulationParams {
  population: number;
  criticalWorkerPercent: number;
  startingStockpile: number;
  masksPerWorkerPerDay: number;
  currentManufacturingCapacity: number;
  peakManufacturingCapacity: number;
  daysToPeakCapacity: number;
}

export interface DayData {
  day: number;
  dailyDemand: number;
  dailySupply: number;
  cumulativeDemand: number;
  cumulativeSupply: number;
  stockpile: number;
  protectionRate: number; // Percentage of critical workers protected (0-100)
}

export interface SimulationResults {
  dailyData: DayData[];
  shortfallDay: number | null;
  peakDailyShortfall: number;
  totalShortfall: number;
  minProtectionRate: number; // Minimum percentage of workers protected
}

export function runSimulation(params: SimulationParams): SimulationResults {
  const {
    population,
    criticalWorkerPercent,
    startingStockpile,
    masksPerWorkerPerDay,
    currentManufacturingCapacity,
    peakManufacturingCapacity,
    daysToPeakCapacity,
  } = params;

  // Calculate daily demand: (population × critical_worker_%) × masks per day
  const criticalWorkers = population * (criticalWorkerPercent / 100);
  const dailyDemand = criticalWorkers * masksPerWorkerPerDay;

  const dailyData: DayData[] = [];
  let cumulativeDemand = 0;
  let cumulativeSupply = 0;
  let shortfallDay: number | null = null;
  let peakDailyShortfall = 0;
  let minProtectionRate = 100;

  // Run simulation for 730 days (2 years)
  for (let day = 0; day <= 730; day++) {
    // Calculate daily supply with linear ramp-up to peak capacity
    let dailySupply: number;
    if (day < daysToPeakCapacity) {
      // Linear interpolation from current to peak
      dailySupply =
        currentManufacturingCapacity +
        (day * (peakManufacturingCapacity - currentManufacturingCapacity)) / daysToPeakCapacity;
    } else {
      // At peak capacity
      dailySupply = peakManufacturingCapacity;
    }

    cumulativeDemand += dailyDemand;
    cumulativeSupply += dailySupply;

    // Calculate remaining stockpile
    const stockpile = startingStockpile + cumulativeSupply - cumulativeDemand;

    // Track when stockpile is depleted (goes negative or zero)
    if (shortfallDay === null && stockpile <= 0) {
      shortfallDay = day;
    }

    // Calculate daily shortfall (when demand exceeds supply)
    const dailyShortfall = Math.max(0, dailyDemand - dailySupply);
    peakDailyShortfall = Math.max(peakDailyShortfall, dailyShortfall);

    // Calculate protection rate
    // If stockpile is available, we can meet demand = 100% protected
    // Once stockpile is depleted, protection rate = (supply / demand) * 100
    let protectionRate: number;
    if (stockpile > 0) {
      protectionRate = 100;
    } else {
      protectionRate = dailyDemand > 0 ? Math.min(100, (dailySupply / dailyDemand) * 100) : 100;
    }
    minProtectionRate = Math.min(minProtectionRate, protectionRate);

    dailyData.push({
      day,
      dailyDemand,
      dailySupply,
      cumulativeDemand,
      cumulativeSupply,
      stockpile,
      protectionRate,
    });
  }

  // Calculate total shortfall over the year
  const totalShortfall = Math.max(0, cumulativeDemand - (startingStockpile + cumulativeSupply));

  return {
    dailyData,
    shortfallDay,
    peakDailyShortfall,
    totalShortfall,
    minProtectionRate,
  };
}


// Helper to round up to nearest 100k
export function roundUpTo100k(value: number): number {
  return Math.ceil(value / 100_000) * 100_000;
}

// Default parameters for US scenario
export const DEFAULT_PARAMS: SimulationParams = {
  population: 340_000_000,
  criticalWorkerPercent: 15,
  startingStockpile: 340_000_000, // Matches US population
  masksPerWorkerPerDay: 0.2,
  currentManufacturingCapacity: roundUpTo100k(340_000_000 * 0.002), // 0.2% of population
  peakManufacturingCapacity: roundUpTo100k(340_000_000 * 0.015), // 1.5% of population
  daysToPeakCapacity: 180,
};
