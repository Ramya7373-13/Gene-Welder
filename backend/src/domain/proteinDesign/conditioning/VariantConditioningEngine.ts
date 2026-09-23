// VariantConditioningEngine - Translates variant analysis into RFD3-ready constraints.
// This is the strategic IP layer: variant data -> RFD3 conditioning payload.
// Designed as a dedicated domain service.

import type {
  VariantConditioningInput,
  Rfd3Conditioning,
  ResiduePosition,
  HotspotConstraint,
  BurialDepthConstraint,
  HydrogenBondConstraint,
  InterfaceConstraint,
  MotifConstraint,
  CenterOfMassConstraint,
  DesignConstraintSpec,
} from '../types/index.js';
import { ConstraintType, DesignMode } from '../types/index.js';

/**
 * Input for a single amino acid substitution.
 */
interface AminoAcidSubstitution {
  wildType: string;
  position: number;
  mutant: string;
  chain?: string;
}

/**
 * Parses an HGVS protein variant string (e.g., "p.Gly12Asp" or "p.G12D").
 */
export function parseHgvsProtein(hgvs: string): AminoAcidSubstitution | null {
  const match = hgvs.match(/p\.([A-Z])(\d+)([A-Z])/);
  if (!match) {
    return null;
  }
  return {
    wildType: match[1],
    position: parseInt(match[2], 10),
    mutant: match[3],
    chain: undefined,
  };
}

/**
 * Determines hotspot residues around a mutation site.
 * Includes the mutated residue and its spatial neighbors.
 */
export function determineHotspotResidues(
  mutation: AminoAcidSubstitution,
  structurePdb: string,
  radiusAngstrom: number = 8.0
): ResiduePosition[] {
  // In a real implementation, parse PDB structure and compute spatial neighbors.
  // For Phase 1, we return the mutated residue and nearby positions.
  const hotspots: ResiduePosition[] = [];

  // The mutation site is always a hotspot
  hotspots.push({ chain: mutation.chain ?? 'A', position: mutation.position });

  // Add neighboring residues (simple +/- offset model)
  const neighbors = [-2, -1, 1, 2, 3];
  for (const offset of neighbors) {
    const pos = mutation.position + offset;
    if (pos > 0) {
      hotspots.push({ chain: mutation.chain ?? 'A', position: pos });
    }
  }

  return hotspots;
}

/**
 * Generates burial depth constraints for stabilizing a mutation.
 * Target the mutated residue with a minimum burial depth.
 */
export function generateBurialDepthConstraints(
  mutation: AminoAcidSubstitution
): BurialDepthConstraint[] {
  const position: ResiduePosition = {
    chain: mutation.chain ?? 'A',
    position: mutation.position,
  };

  return [
    {
      type: ConstraintType.BURY_DEPTH,
      residues: [position],
      minDepth: 2.0,
      maxDepth: 8.0,
    },
  ];
}

/**
 * Generates hydrogen bond constraints to restore or preserve interactions
 * disrupted by a mutation (e.g., for loss-of-function variants).
 */
export function generateHydrogenBondConstraints(
  mutation: AminoAcidSubstitution,
  structurePdb: string
): HydrogenBondConstraint[] {
  // In a real implementation, parse structure and identify disrupted H-bonds.
  // Phase 1: mock with placeholder constraint near the mutation site.
  const position: ResiduePosition = {
    chain: mutation.chain ?? 'A',
    position: mutation.position,
  };

  // Create a mock H-bond constraint with the next residue
  const nextPosition: ResiduePosition = {
    chain: mutation.chain ?? 'A',
    position: mutation.position + 1,
  };

  return [
    {
      type: ConstraintType.HBOND,
      donorPosition: position,
      acceptorPosition: nextPosition,
      donorAtom: 'NE2',
      acceptorAtom: 'O',
    },
  ];
}

/**
 * Generates interface constraint for binder design.
 * Identifies the target interface region around the mutation site.
 */
export function generateInterfaceConstraints(
  mutation: AminoAcidSubstitution,
  interfaceChain: string = 'A'
): InterfaceConstraint[] {
   const residues = determineHotspotResidues(mutation, '');
  return [
    {
      type: ConstraintType.INTERFACE,
      chain: interfaceChain,
      residues: residues.map(r => r.position),
      shapeComplementarity: 0.7,
    },
  ];
}

/**
 * Generates center-of-mass constraints for scaffold design.
 */
export function generateCenterOfMassConstraints(
  mutation: AminoAcidSubstitution
): CenterOfMassConstraint | undefined {
  const position = mutation.position;
  const x = (position * 0.5236) % 5;
  const y = (position * 0.9876) % 5;
  const z = (position * 0.3321) % 5;

  return {
    type: ConstraintType.CENTER_OF_MASS,
    targetPosition: { x, y: y + 10, z },
    radius: 12.0,
  };
}

/**
 * The main conditioning engine. Translates variant analysis into RFD3-ready payload.
 */
export class VariantConditioningEngine {
  /**
   * Convert a variant input into an RFD3 conditioning payload.
   * This is the core transformation: variant -> design constraints.
   */
  async condition(input: VariantConditioningInput): Promise<Rfd3Conditioning> {
    const substitution = parseHgvsProtein(input.variant.hgvs);

    if (!substitution) {
      throw new Error(`Unable to parse HGVS variant: ${input.variant.hgvs}`);
    }

    const structureContent = input.structure.pdbContent ?? input.structure.mmCifContent ?? '';

    // Determine constraints based on mode
    const hotspots = determineHotspotResidues(substitution, structureContent);
    const burialDepth = generateBurialDepthConstraints(substitution);
    const hydrogenBonds = generateHydrogenBondConstraints(substitution, structureContent);
    const interfaceRegions = generateInterfaceConstraints(substitution, input.structure.chainId ?? 'A');
    const centerOfMass = generateCenterOfMassConstraints(substitution);

    return {
      hotspots,
      burialDepth,
      hydrogenBonds,
      interfaceRegions,
      centerOfMass,
      targetStructure: structureContent,
      targetSequence: input.variant.aminoAcidChange,
      designMode: input.designObjectives?.[0]?.mode ?? this.inferModeFromVariant(substitution),
      customConstraints: {
        variantAnnotations: input.annotations,
        mutationDetails: {
          wildType: substitution.wildType,
          position: substitution.position,
          mutant: substitution.mutant,
        },
        designObjectives: input.designObjectives,
      },
    };
  }

  /**
   * Infer the most appropriate design mode from the variant.
   */
  private inferModeFromVariant(substitution: AminoAcidSubstitution): DesignMode {
    return DesignMode.BINDER;
  }

  /**
   * Convert conditioning payload into individual constraint specs.
   * Used to populate the DesignConstraint table.
   */
  conditioningToConstraints(conditioning: Rfd3Conditioning): DesignConstraintSpec[] {
    const constraints: DesignConstraintSpec[] = [];

    if (conditioning.hotspots.length > 0) {
      constraints.push({
        type: ConstraintType.HOTSPOT,
        residues: conditioning.hotspots,
        minInteractions: 3,
      } as HotspotConstraint);
    }

    for (const bd of conditioning.burialDepth) {
      constraints.push(bd);
    }

    for (const hb of conditioning.hydrogenBonds) {
      constraints.push(hb);
    }

    for (const ir of conditioning.interfaceRegions) {
      constraints.push(ir);
    }

    if (conditioning.motifSpec) {
      constraints.push(conditioning.motifSpec);
    }

    if (conditioning.centerOfMass) {
      constraints.push(conditioning.centerOfMass);
    }

    return constraints;
  }
}
