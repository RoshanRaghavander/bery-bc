import { EventEmitter } from 'events';

export class MockP2PNetwork extends EventEmitter {
    constructor() {
        super();
        this.peers = [];
    }

    async start() {
        return Promise.resolve();
    }

    async stop() {
        return Promise.resolve();
    }

    async broadcastBlock(block) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 10));
        this.emit('broadcast_block', block);
    }

    async broadcastTx(tx) {
        this.emit('broadcast_tx', tx);
    }
}
