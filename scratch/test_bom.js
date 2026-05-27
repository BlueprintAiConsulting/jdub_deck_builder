import { calculateAll } from '../src/engine/structuralCalc.js';
import { generateBOM } from '../src/engine/bomGenerator.js';

const config = {
  width: 192,
  depth: 144,
  height: 36,
  joistSize: '2x8',
  joistSpacing: 16,
  species: 'SYP',
  beamConfig: '2-2x10',
  postSize: '6x6',
  deckBoardSize: '5/4x6',
  deckMaterial: 'PT-SYP',
  joistOrientation: 'vertical',
  deckingOrientation: 'perpendicular',
  vertices: [],
  ledgerAttached: true,
  stairs: null
};

const calcs = calculateAll(config);
const bom = generateBOM(config, calcs);
console.log('BOM items:', bom.map(item => item.id));
