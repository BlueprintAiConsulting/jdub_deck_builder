const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Viewport3D/Scene3D.jsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Replace getProceduralTexture and getProceduralBumpTexture
const texLoaderCode = `
import { TextureLoader, RepeatWrapping, SRGBColorSpace, Color } from 'three';
const textureLoader = new TextureLoader();
const staticTextures = {};

function loadStaticTexture(name, repeatX = 1, repeatY = 1, isColor = true) {
  const key = name + repeatX + repeatY + isColor;
  if (staticTextures[key]) return staticTextures[key];
  const tex = textureLoader.load('/textures/' + name + '.png');
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) tex.colorSpace = SRGBColorSpace;
  staticTextures[key] = tex;
  return tex;
}

export function getProceduralTexture(colorHex, type) {
  if (type === 'siding') return loadStaticTexture('siding', 1, 1);
  if (type === 'concrete') return loadStaticTexture('concrete', 4, 4);
  if (type === 'shingles') return loadStaticTexture('shingles', 4, 4);
  if (type && type.startsWith('wood')) return loadStaticTexture('wood_grain', 1, 4, false); // grayscale
  if (type && type.startsWith('composite')) return loadStaticTexture('composite_grain', 1, 4, false); // grayscale
  
  // fallback for grass or undefined
  if (type === 'grass') {
    return _legacyProceduralTexture(colorHex, type);
  }
  return null;
}

export function getProceduralBumpTexture(type) {
  if (type && type.startsWith('wood')) return loadStaticTexture('wood_grain', 1, 4, false);
  if (type && type.startsWith('composite')) return loadStaticTexture('composite_grain', 1, 4, false);
  return null;
}

function _legacyProceduralTexture(colorHex, type) {`;

code = code.replace(/export function getProceduralTexture\(colorHex, type\) \{/, texLoaderCode);
code = code.replace(/export function getProceduralBumpTexture\(type\) \{/, 'function _legacyProceduralBumpTexture(type) {');

// 2. Add color={color} to deck components' materials
code = code.replace(/<meshStandardMaterial map=\{tex\}/g, '<meshStandardMaterial color={color} map={tex}');
code = code.replace(/<meshStandardMaterial map=\{postTex\}/g, '<meshStandardMaterial color={color} map={postTex}');
code = code.replace(/<meshStandardMaterial map=\{railTex\}/g, '<meshStandardMaterial color={color} map={railTex}');
code = code.replace(/<meshStandardMaterial map=\{balTex\}/g, '<meshStandardMaterial color={color} map={balTex}');
code = code.replace(/<meshStandardMaterial map=\{strTex\}/g, '<meshStandardMaterial color={color} map={strTex}');
code = code.replace(/<meshStandardMaterial map=\{postLTex\}/g, '<meshStandardMaterial color={color} map={postLTex}');
code = code.replace(/<meshStandardMaterial map=\{postRTex\}/g, '<meshStandardMaterial color={color} map={postRTex}');
code = code.replace(/<meshStandardMaterial map=\{postL1Tex\}/g, '<meshStandardMaterial color={color} map={postL1Tex}');
code = code.replace(/<meshStandardMaterial map=\{postR1Tex\}/g, '<meshStandardMaterial color={color} map={postR1Tex}');
code = code.replace(/<meshStandardMaterial map=\{postL2Tex\}/g, '<meshStandardMaterial color={color} map={postL2Tex}');
code = code.replace(/<meshStandardMaterial map=\{postR2Tex\}/g, '<meshStandardMaterial color={color} map={postR2Tex}');
code = code.replace(/<meshStandardMaterial map=\{rimLTex\}/g, '<meshStandardMaterial color={color} map={rimLTex}');
code = code.replace(/<meshStandardMaterial map=\{rimRTex\}/g, '<meshStandardMaterial color={color} map={rimRTex}');
code = code.replace(/<meshStandardMaterial map=\{rimFTex\}/g, '<meshStandardMaterial color={color} map={rimFTex}');
code = code.replace(/<meshStandardMaterial map=\{rimBTex\}/g, '<meshStandardMaterial color={color} map={rimBTex}');
code = code.replace(/<meshStandardMaterial map=\{intTex\}/g, '<meshStandardMaterial color={color} map={intTex}');

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully patched realistic textures!');
