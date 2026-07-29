export type WallType = "civil" | "gypsum" | "plywood" | "gypsum-glass" | "plywood-glass" | "gypsum-plywood";

export const wallOptions = [
  { label: "Civil Wall (Brick)", value: "civil" },
  { label: "Gypsum Partition", value: "gypsum" },
  { label: "Plywood Partition", value: "plywood" },
  { label: "Gypsum + Plywood", value: "gypsum-plywood" },
  { label: "Gypsum + Glass", value: "gypsum-glass" },
  { label: "Plywood + Glass", value: "plywood-glass" },
];

export const subOptionsMap: Record<WallType, string[]> = {
  civil: ["4.5 inch", "9 inch"],
  gypsum: ["Single Layer", "Double Layer"],
  plywood: ["Single Glazing", "Double Glazing"],
  "gypsum-plywood": ["Single Layer", "Double Layer"],
  "gypsum-glass": ["Single Glazing", "Double Glazing"],
  "plywood-glass": ["Single Glazing", "Double Glazing"],
};

// Detailed options for glass partitions
export const glassPartitionOptions = {
  "gypsum-glass": {
    glazingType: ["Single Glazing", "Double Glazing"],
    glassType: ["Clear", "Tinted", "Frosted"],
    laminateType: ["6mm", "8mm", "10mm", "12mm"],
    beadingStyle: ["Aluminum", "Wooden", "PVC"],
    finish: ["Matte", "Glossy", "Semi-Gloss"],
    frameType: ["Aluminum", "Wooden", "Steel"],
  },
  "plywood-glass": {
    glazingType: ["Single Glazing", "Double Glazing"],
    glassType: ["Clear", "Tinted", "Frosted"],
    laminateType: ["6mm", "8mm", "10mm", "12mm"],
    beadingStyle: ["Aluminum", "Wooden", "PVC"],
    finish: ["Matte", "Glossy", "Semi-Gloss"],
    frameType: ["Aluminum", "Wooden", "Steel"],
  },
};

export const plywoodTypes = ["4mm", "6mm", "8mm", "12mm"];
export const glassTypes = ["Clear", "Tinted", "Frosted"];
export const finishOptions = ["Matte", "Glossy", "Semi-Gloss"];
export const frameOptions = ["Aluminum", "Wooden"];

export interface Material {
  id: string;
  name: string;
  category: string;
  description: string;
  technicalSpecs: {
    strength: string;
    density: string;
    fireRating: string;
    soundInsulation: string;
    waterResistance: string;
    durability: string;
    cost: string;
    installationTime: string;
  };
}

export interface Shop {
  id: string;
  name: string;
  location?: string;
  rating?: number;
}

export const materialsByType: Record<string, Material[]> = {
  civil: [
    {
      id: "brick-red",
      name: "Red Brick",
      category: "Civil",
      description: "Standard clay red brick for load-bearing walls",
      technicalSpecs: {
        strength: "5-10 MPa",
        density: "1600-1900 kg/m³",
        fireRating: "4 hours",
        soundInsulation: "40 dB",
        waterResistance: "Good",
        durability: "50-100 years",
        cost: "₹6-8 per piece",
        installationTime: "10-15 pieces/hour"
      }
    },
    {
      id: "brick-flyash",
      name: "Fly Ash Brick",
      category: "Civil",
      description: "Eco-friendly brick made from fly ash",
      technicalSpecs: {
        strength: "4-8 MPa",
        density: "1400-1600 kg/m³",
        fireRating: "4 hours",
        soundInsulation: "38 dB",
        waterResistance: "Excellent",
        durability: "40-80 years",
        cost: "₹5-7 per piece",
        installationTime: "12-18 pieces/hour"
      }
    },
    {
      id: "block-concrete",
      name: "Concrete Block",
      category: "Civil",
      description: "Reinforced concrete block for quick construction",
      technicalSpecs: {
        strength: "3.5-7 MPa",
        density: "1800-2000 kg/m³",
        fireRating: "2-4 hours",
        soundInsulation: "45 dB",
        waterResistance: "Very Good",
        durability: "60-100 years",
        cost: "₹40-60 per block",
        installationTime: "8-12 blocks/hour"
      }
    },
    {
      id: "cement-opc",
      name: "Ordinary Portland Cement (OPC)",
      category: "Cement",
      description: "Standard 50kg bag of OPC cement for masonry",
      technicalSpecs: {
        strength: "42.5-52.5 MPa",
        density: "3140-3150 kg/m³",
        fireRating: "N/A",
        soundInsulation: "N/A",
        waterResistance: "Good",
        durability: "Permanent",
        cost: "₹380-420 per bag",
        installationTime: "N/A"
      }
    },
    {
      id: "cement-ppc",
      name: "Pozzolana Portland Cement (PPC)",
      category: "Cement",
      description: "Eco-friendly cement with pozzolanic material",
      technicalSpecs: {
        strength: "32.5 MPa",
        density: "3050-3100 kg/m³",
        fireRating: "N/A",
        soundInsulation: "N/A",
        waterResistance: "Excellent",
        durability: "Permanent",
        cost: "₹340-380 per bag",
        installationTime: "N/A"
      }
    },
    {
      id: "sand-river",
      name: "River Sand",
      category: "Sand",
      description: "Natural river sand for masonry work",
      technicalSpecs: {
        strength: "N/A",
        density: "1550-1600 kg/m³",
        fireRating: "N/A",
        soundInsulation: "N/A",
        waterResistance: "Good",
        durability: "Permanent",
        cost: "₹20-30 per cft",
        installationTime: "N/A"
      }
    },
    {
      id: "sand-m",
      name: "M-Sand (Manufactured Sand)",
      category: "Sand",
      description: "Crushed manufactured sand with uniform particles",
      technicalSpecs: {
        strength: "N/A",
        density: "1650-1700 kg/m³",
        fireRating: "N/A",
        soundInsulation: "N/A",
        waterResistance: "Excellent",
        durability: "Permanent",
        cost: "₹25-35 per cft",
        installationTime: "N/A"
      }
    },
    {
      id: "brick-solid",
      name: "Solid Concrete Brick",
      category: "Civil",
      description: "Heavy-duty solid concrete brick for load-bearing",
      technicalSpecs: {
        strength: "8-12 MPa",
        density: "1900-2100 kg/m³",
        fireRating: "4 hours",
        soundInsulation: "42 dB",
        waterResistance: "Excellent",
        durability: "100+ years",
        cost: "₹12-15 per piece",
        installationTime: "8-10 pieces/hour"
      }
    },
    {
      id: "cement-slag",
      name: "Slag Portland Cement (SPC)",
      category: "Cement",
      description: "Industrial cement with slag for durability",
      technicalSpecs: {
        strength: "42.5 MPa",
        density: "3040-3100 kg/m³",
        fireRating: "N/A",
        soundInsulation: "N/A",
        waterResistance: "Excellent",
        durability: "Permanent",
        cost: "₹400-450 per bag",
        installationTime: "N/A"
      }
    },
    {
      id: "sand-crushed",
      name: "Crushed Stone Sand",
      category: "Sand",
      description: "Angular crushed sand for better binding",
      technicalSpecs: {
        strength: "N/A",
        density: "1700-1800 kg/m³",
        fireRating: "N/A",
        soundInsulation: "N/A",
        waterResistance: "Excellent",
        durability: "Permanent",
        cost: "₹30-40 per cft",
        installationTime: "N/A"
      }
    }
  ],
  gypsum: [
    {
      id: "gypsum-basic",
      name: "Standard Gypsum Board",
      category: "Gypsum",
      description: "Regular gypsum partition board 12mm thickness",
      technicalSpecs: {
        strength: "3-4 MPa",
        density: "750-850 kg/m³",
        fireRating: "30 mins",
        soundInsulation: "35 dB",
        waterResistance: "Poor",
        durability: "20-30 years",
        cost: "₹35-45 per sheet",
        installationTime: "4-6 sheets/hour"
      }
    },
    {
      id: "gypsum-fire",
      name: "Fire-Resistant Gypsum",
      category: "Gypsum",
      description: "Fire-rated gypsum board with glass fiber",
      technicalSpecs: {
        strength: "4-5 MPa",
        density: "800-900 kg/m³",
        fireRating: "60-120 mins",
        soundInsulation: "38 dB",
        waterResistance: "Fair",
        durability: "30-40 years",
        cost: "₹50-65 per sheet",
        installationTime: "3-5 sheets/hour"
      }
    },
    {
      id: "gypsum-moisture",
      name: "Moisture-Resistant Gypsum",
      category: "Gypsum",
      description: "Green gypsum board for wet areas like bathrooms",
      technicalSpecs: {
        strength: "4 MPa",
        density: "800 kg/m³",
        fireRating: "30 mins",
        soundInsulation: "36 dB",
        waterResistance: "Excellent",
        durability: "30-40 years",
        cost: "₹55-70 per sheet",
        installationTime: "4-6 sheets/hour"
      }
    },
    {
      id: "rockwool-insulation",
      name: "Rockwool Insulation Batts",
      category: "Insulation",
      description: "Fire and sound-proof mineral wool insulation",
      technicalSpecs: {
        strength: "N/A",
        density: "30-50 kg/m³",
        fireRating: "Class A1",
        soundInsulation: "40 dB",
        waterResistance: "Good",
        durability: "50+ years",
        cost: "₹150-200 per bag",
        installationTime: "70 sqft/bag"
      }
    }
  ],
  plywood: [
    {
      id: "plywood-birch",
      name: "Birch Plywood",
      category: "Plywood",
      description: "Premium birch plywood with excellent finish",
      technicalSpecs: {
        strength: "35-45 MPa",
        density: "600-700 kg/m³",
        fireRating: "No rating",
        soundInsulation: "32 dB",
        waterResistance: "Fair",
        durability: "15-20 years",
        cost: "₹400-500 per sheet",
        installationTime: "2-4 sheets/hour"
      }
    },
    {
      id: "plywood-marine",
      name: "Marine Plywood",
      category: "Plywood",
      description: "Water-resistant plywood for humid areas",
      technicalSpecs: {
        strength: "30-40 MPa",
        density: "700-800 kg/m³",
        fireRating: "No rating",
        soundInsulation: "34 dB",
        waterResistance: "Excellent",
        durability: "25-35 years",
        cost: "₹450-600 per sheet",
        installationTime: "2-4 sheets/hour"
      }
    },
    {
      id: "plywood-commercial",
      name: "Commercial Plywood",
      category: "Plywood",
      description: "Standard commercial-grade plywood for partitions",
      technicalSpecs: {
        strength: "32-38 MPa",
        density: "650-750 kg/m³",
        fireRating: "No rating",
        soundInsulation: "31 dB",
        waterResistance: "Fair",
        durability: "12-18 years",
        cost: "₹350-420 per sheet",
        installationTime: "3-5 sheets/hour"
      }
    },
    {
      id: "laminate-hpl",
      name: "High-Pressure Laminate",
      category: "Laminate",
      description: "Decorative laminate finish for plywood",
      technicalSpecs: {
        strength: "60-80 MPa",
        density: "1400-1600 kg/m³",
        fireRating: "Class B",
        soundInsulation: "N/A",
        waterResistance: "Excellent",
        durability: "20-30 years",
        cost: "₹80-120 per sqft",
        installationTime: "10-15 sqft/hour"
      }
    }
  ],
  "gypsum-glass": [
    {
      id: "gypsum-glass-board",
      name: "Gypsum Board",
      category: "Gypsum",
      description: "Standard gypsum board for glass partition frame",
      technicalSpecs: {
        strength: "3-4 MPa",
        density: "750-850 kg/m³",
        fireRating: "30 mins",
        soundInsulation: "35 dB",
        waterResistance: "Poor",
        durability: "20-30 years",
        cost: "₹35-45 per sheet",
        installationTime: "4-6 sheets/hour"
      }
    },
    {
      id: "glass-clear",
      name: "Clear Tempered Glass",
      category: "Glass",
      description: "Clear tempered glass panels for partition",
      technicalSpecs: {
        strength: "120 MPa",
        density: "2500 kg/m³",
        fireRating: "N/A",
        soundInsulation: "28 dB",
        waterResistance: "Excellent",
        durability: "50+ years",
        cost: "₹300-400 per sqft",
        installationTime: "2-3 sqft/hour"
      }
    },
    {
      id: "frame-aluminum",
      name: "Aluminum Frame",
      category: "Frame",
      description: "Lightweight aluminum frame for glass panels",
      technicalSpecs: {
        strength: "240-290 MPa",
        density: "2700 kg/m³",
        fireRating: "N/A",
        soundInsulation: "N/A",
        waterResistance: "Excellent",
        durability: "40-50 years",
        cost: "₹200-250 per meter",
        installationTime: "5-8 meters/hour"
      }
    }
  ],
  "plywood-glass": [
    {
      id: "plywood-glass-birch",
      name: "Birch Plywood",
      category: "Plywood",
      description: "Plywood for lower portion of glass partition",
      technicalSpecs: {
        strength: "35-45 MPa",
        density: "600-700 kg/m³",
        fireRating: "No rating",
        soundInsulation: "32 dB",
        waterResistance: "Fair",
        durability: "15-20 years",
        cost: "₹400-500 per sheet",
        installationTime: "2-4 sheets/hour"
      }
    },
    {
      id: "glass-frosted",
      name: "Frosted Tempered Glass",
      category: "Glass",
      description: "Frosted tempered glass for privacy with light",
      technicalSpecs: {
        strength: "120 MPa",
        density: "2500 kg/m³",
        fireRating: "N/A",
        soundInsulation: "30 dB",
        waterResistance: "Excellent",
        durability: "50+ years",
        cost: "₹350-450 per sqft",
        installationTime: "2-3 sqft/hour"
      }
    },
    {
      id: "frame-aluminum-glass",
      name: "Aluminum Frame",
      category: "Frame",
      description: "Aluminum frame for mixed plywood and glass partition",
      technicalSpecs: {
        strength: "240-290 MPa",
        density: "2700 kg/m³",
        fireRating: "N/A",
        soundInsulation: "N/A",
        waterResistance: "Excellent",
        durability: "40-50 years",
        cost: "₹200-250 per meter",
        installationTime: "5-8 meters/hour"
      }
    }
  ]
};
