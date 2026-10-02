import type { Library, StudySource } from '../types';
import { buildStudyContent, GENERATION_VERSION } from './study';

const sources: StudySource[] = [
  {
    id: 'demo-cells',
    name: 'Biology · Cells & energy.pdf',
    kind: 'notes',
    format: 'PDF',
    wordCount: 235,
    warnings: [],
    blocks: [
      {
        label: 'Page 1',
        text: 'The cell membrane is a selectively permeable barrier that controls the movement of substances into and out of a cell.\nThe nucleus is the organelle that contains most of a eukaryotic cell’s genetic material.\nMitochondria are organelles where most ATP is produced during aerobic cellular respiration.\nRibosomes are cellular structures that assemble proteins using instructions carried by messenger RNA.\nDiffusion is the net movement of particles from an area of higher concentration to an area of lower concentration.',
      },
      {
        label: 'Page 2',
        text: 'Osmosis is the movement of water across a selectively permeable membrane toward the side with a higher solute concentration.\nActive transport is the movement of substances against their concentration gradient using energy.\nPhotosynthesis is the process that converts light energy into chemical energy stored in sugars.\nChlorophyll is the green pigment that absorbs light for photosynthesis in plants.\nChloroplasts are the organelles where photosynthesis occurs in plant and algal cells.',
      },
      {
        label: 'Page 3',
        text: 'Cellular respiration is the process by which cells transfer energy from organic molecules to ATP.\nATP is a molecule that transfers energy to power many cellular processes.\nEnzymes are biological catalysts that speed up reactions by lowering their activation energy.\nHomeostasis is the maintenance of relatively stable internal conditions in an organism.\nGlycolysis is the first stage of cellular respiration, in which glucose is broken down into two pyruvate molecules.',
      },
    ],
  },
  {
    id: 'demo-dna',
    name: 'Genetics · Lecture slides.pptx',
    kind: 'notes',
    format: 'PPTX',
    wordCount: 145,
    warnings: [],
    blocks: [
      {
        label: 'Slide 1',
        text: 'DNA is the molecule that stores hereditary information in most living organisms.\nA gene is a segment of DNA whose sequence contributes to a functional product, such as a protein or RNA.\nAn allele is a version of a gene at a particular location on a chromosome.\nGenotype is the combination of alleles an organism carries for a particular trait.',
      },
      {
        label: 'Slide 2',
        text: 'Phenotype is an organism’s observable characteristics resulting from its genotype and environment.\nMitosis is cell division that produces two daughter cells with the same chromosome number as the parent cell.\nMeiosis is cell division that reduces the chromosome number by half to produce haploid cells.\nA mutation is a change in the nucleotide sequence of genetic material.',
      },
    ],
  },
  {
    id: 'demo-exam',
    name: 'Practice exam · Biology.txt',
    kind: 'exam',
    format: 'TXT',
    wordCount: 39,
    warnings: [],
    blocks: [
      {
        label: 'Section 1',
        text: '1. Explain how the cell membrane controls the movement of substances into a cell.\n2. Compare mitosis and meiosis in terms of chromosome number in the resulting daughter cells.\n3. Describe the role of enzymes in cellular reactions.',
      },
    ],
  },
];
export function demoLibrary(): Library {
  const deck = {
    generationVersion: GENERATION_VERSION,
    id: 'demo-biology',
    title: 'Biology essentials',
    description: 'Cells, energy & a little bit of DNA',
    createdAt: Date.now(),
    isDemo: true,
    sources,
    ...buildStudyContent(sources),
    progress: {},
    sessions: [],
  };
  return { version: 1, activeId: deck.id, decks: [deck] };
}
