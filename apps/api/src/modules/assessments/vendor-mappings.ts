export interface MetricMapping {
  metricKey: string;
  name: string;
  unit: string;
  category: string;
}

export const VENDOR_MAPPING_VERSION = "2026.1";

export const VENDOR_METRIC_MAPPINGS: Record<string, Record<string, MetricMapping>> = {
  lookinbody_inbody: {
    weight: { metricKey: "weight_kg", name: "Weight", unit: "kg", category: "body_composition" },
    Weight: { metricKey: "weight_kg", name: "Weight", unit: "kg", category: "body_composition" },
    PBF: {
      metricKey: "body_fat_percentage",
      name: "Percent Body Fat",
      unit: "%",
      category: "body_composition"
    },
    BodyFat: {
      metricKey: "body_fat_percentage",
      name: "Percent Body Fat",
      unit: "%",
      category: "body_composition"
    },
    SMM: {
      metricKey: "skeletal_muscle_mass",
      name: "Skeletal Muscle Mass",
      unit: "kg",
      category: "body_composition"
    },
    MuscleMass: {
      metricKey: "skeletal_muscle_mass",
      name: "Skeletal Muscle Mass",
      unit: "kg",
      category: "body_composition"
    },
    BMI: {
      metricKey: "body_mass_index",
      name: "Body Mass Index",
      unit: "kg/m²",
      category: "body_composition"
    },
    BMR: {
      metricKey: "basal_metabolic_rate",
      name: "Basal Metabolic Rate",
      unit: "kcal",
      category: "metabolism"
    },
    TBW: {
      metricKey: "total_body_water",
      name: "Total Body Water",
      unit: "L",
      category: "hydration"
    },
    ECW: {
      metricKey: "extracellular_water",
      name: "Extracellular Water",
      unit: "L",
      category: "hydration"
    },
    ECWRatio: {
      metricKey: "ecw_ratio",
      name: "ECW / TBW Ratio",
      unit: "ratio",
      category: "hydration"
    },
    VisceralFatLevel: {
      metricKey: "visceral_fat_level",
      name: "Visceral Fat Level",
      unit: "lvl",
      category: "body_composition"
    }
  },
  vald_forcedecks: {
    JumpHeight: { metricKey: "jump_height_cm", name: "Jump Height", unit: "cm", category: "power" },
    PeakForce: { metricKey: "peak_force_n", name: "Peak Force", unit: "N", category: "strength" },
    PeakPower: { metricKey: "peak_power_w", name: "Peak Power", unit: "W", category: "power" },
    RSI: {
      metricKey: "reactive_strength_index",
      name: "Reactive Strength Index",
      unit: "m/s",
      category: "power"
    },
    RSIMod: { metricKey: "rsi_modified", name: "RSI Modified", unit: "m/s", category: "power" },
    EccentricDecelerationImpulse: {
      metricKey: "ecc_decel_impulse",
      name: "Eccentric Decel Impulse",
      unit: "N·s",
      category: "kinetics"
    },
    ConcentricImpulse: {
      metricKey: "concentric_impulse",
      name: "Concentric Impulse",
      unit: "N·s",
      category: "kinetics"
    },
    Asymmetry: {
      metricKey: "force_asymmetry_pct",
      name: "Force Asymmetry",
      unit: "%",
      category: "symmetry"
    }
  },
  cosmed_k5: {
    VO2max: {
      metricKey: "vo2_max",
      name: "VO2 Max",
      unit: "mL/kg/min",
      category: "cardiovascular"
    },
    VCO2: { metricKey: "vco2", name: "VCO2 Output", unit: "L/min", category: "metabolism" },
    RER: {
      metricKey: "respiratory_exchange_ratio",
      name: "Respiratory Exchange Ratio",
      unit: "ratio",
      category: "metabolism"
    },
    VT1: {
      metricKey: "ventilatory_threshold_1",
      name: "Ventilatory Threshold 1 (Aerobic)",
      unit: "mL/kg/min",
      category: "cardiovascular"
    },
    VT2: {
      metricKey: "ventilatory_threshold_2",
      name: "Ventilatory Threshold 2 (Anaerobic)",
      unit: "mL/kg/min",
      category: "cardiovascular"
    },
    MaxHR: {
      metricKey: "max_heart_rate",
      name: "Max Heart Rate",
      unit: "bpm",
      category: "cardiovascular"
    }
  },
  pnoe: {
    VO2max: {
      metricKey: "vo2_max",
      name: "VO2 Max",
      unit: "mL/kg/min",
      category: "cardiovascular"
    },
    FatMax: {
      metricKey: "fat_max_hr",
      name: "FatMax Heart Rate",
      unit: "bpm",
      category: "metabolism"
    },
    AerobicCapacity: {
      metricKey: "aerobic_capacity_score",
      name: "Aerobic Capacity Score",
      unit: "pts",
      category: "cardiovascular"
    },
    BiologicalAge: {
      metricKey: "biological_fitness_age",
      name: "Metabolic Biological Age",
      unit: "yrs",
      category: "longevity"
    }
  }
};
