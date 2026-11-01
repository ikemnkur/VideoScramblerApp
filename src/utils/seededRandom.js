export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    let value = (state += 0x6D2B79F5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function genRandomSeed() {
  if (window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return buffer[0] >>> 0;
  }
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

export function seededPermutation(size, seed) {
  const random = mulberry32(seed >>> 0);
  const permutation = Array.from({ length: size }, (_, index) => index);
  for (let index = size - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [permutation[index], permutation[swapIndex]] = [permutation[swapIndex], permutation[index]];
  }
  return permutation;
}

export function oneBased(values) {
  return values.map((value) => value + 1);
}
