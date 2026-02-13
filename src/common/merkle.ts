import { Hash } from '../crypto/index.js';

export class MerkleTree {
  static computeRoot(leaves: Buffer[]): Buffer {
    if (leaves.length === 0) {
      return Hash.hash(Buffer.from(''));
    }

    let layer = leaves;
    
    while (layer.length > 1) {
      if (layer.length % 2 !== 0) {
        layer.push(layer[layer.length - 1]);
      }
      
      const nextLayer: Buffer[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        const combined = Buffer.concat([layer[i], layer[i + 1]]);
        nextLayer.push(Hash.sha256(combined)); // Use SHA256 for Merkle Tree usually
      }
      layer = nextLayer;
    }
    
    return layer[0];
  }
}
