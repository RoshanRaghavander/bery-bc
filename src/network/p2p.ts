import { createLibp2p, Libp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@libp2p/yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { kadDHT } from '@libp2p/kad-dht';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { gossipsub, GossipSub } from '@chainsafe/libp2p-gossipsub';
import { ping } from '@libp2p/ping';

import { identify } from '@libp2p/identify';
import { EventEmitter } from 'events';
import { pipe } from 'it-pipe';
import * as lp from 'it-length-prefixed';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { Block } from '../core/block.js';
import { Transaction } from '../core/transaction.js';

export interface P2PConfig {
  listenAddresses: string[];
  bootstrapPeers: string[];
  privateKey?: any; // Libp2p PrivateKey
}

export class P2PNetwork extends EventEmitter {
  private node?: Libp2p;
  private readonly config: P2PConfig;
  private readonly TOPIC_BLOCK = 'block';
  private readonly TOPIC_TX = 'tx';
  private readonly TOPIC_CONSENSUS = 'consensus';
  private readonly PROTOCOL_SYNC = '/bery/sync/1.0.0';

  constructor(config: P2PConfig) {
    super();
    this.config = config;
  }

  getTopicPeers(topic: string): number {
      if (!this.node) return 0;
      const pubsub: any = this.node.services.pubsub as any;
      if (pubsub && typeof pubsub.getSubscribers === 'function') {
          return pubsub.getSubscribers(topic).length;
      }
      return 0;
  }

  // Handle incoming sync requests
  private async handleSyncProtocol(props: any) {
      try {
          const stream = props.stream || props;
          if (!stream || !stream.source) {
              console.error('Invalid stream in handleSyncProtocol', props);
              return;
          }

          await pipe(
              stream.source,
              lp.decode,
              async (source: any) => {
                  for await (const msg of source) {
                      const requestStr = uint8ArrayToString(msg.subarray());
                      const request = JSON.parse(requestStr);
                      
                      this.emit('sync:request', request, async (response: any) => {
                           const responseData = uint8ArrayFromString(JSON.stringify(response));
                           await pipe(
                               [responseData],
                               lp.encode,
                               stream.sink
                           );
                      });
                  }
              }
          );
      } catch (err) {
          console.error('Error in sync protocol handler:', err);
      }
  }

  async sendSyncRequest(peerIdStr: string, request: any): Promise<any> {
      if (!this.node) throw new Error('Node not started');
      
      try {
          // Find peer in connected peers
          const peer = this.node.getPeers().find(p => p.toString() === peerIdStr);
          if (!peer) throw new Error(`Peer ${peerIdStr} not found/connected`);

          const stream: any = await this.node.dialProtocol(peer, this.PROTOCOL_SYNC);
          
          const requestData = uint8ArrayFromString(JSON.stringify(request));
          
          let response: any = null;

          await pipe(
              [requestData],
              lp.encode,
              stream.sink
          );
          
          await pipe(
              stream.source,
              lp.decode,
              async (source: any) => {
                  for await (const msg of source) {
                      response = JSON.parse(uint8ArrayToString(msg.subarray()));
                      // We only expect one response for now
                      break; 
                  }
              }
          );
          
          return response;

      } catch (e) {
          console.error(`Failed to send sync request to ${peerIdStr}`, e);
          throw e;
      }
  }

  async start() {
    /*
    const peerDiscovery: any[] = [
      pubsubPeerDiscovery({
        interval: 1000
      })
    ];
    */
    const peerDiscovery: any[] = [];

    if (this.config.bootstrapPeers.length > 0) {
      peerDiscovery.push(bootstrap({
        list: this.config.bootstrapPeers
      }));
    }

    try {
        this.node = await createLibp2p({
            privateKey: this.config.privateKey,
            addresses: {
                listen: this.config.listenAddresses
            },
            transports: [tcp()],
            connectionEncrypters: [noise()],
            streamMuxers: [yamux()],
            peerDiscovery,
            services: {
                // dht: kadDHT(),
                pubsub: gossipsub() as any,
                identify: identify(),
                ping: ping()
            }
        });
        
        // Register Sync Protocol
        await this.node.handle(this.PROTOCOL_SYNC, this.handleSyncProtocol.bind(this));

    } catch (e: any) {
            console.log('Failed to create libp2p node (message):', e.message);
            console.log('Failed to create libp2p node (stack):', e.stack);
            throw e;
        }

    this.node.addEventListener('peer:connect', (evt) => {
      const peerId = evt.detail;
      // console.log('Connected:', peerId.toString());
      this.emit('peer:connect', peerId.toString());
      
      // Log protocols after a delay
      setTimeout(async () => {
          if (!this.node) return;
          const peer = await this.node.peerStore.get(peerId);
          console.log(`Peer ${peerId.toString()} protocols:`, peer.protocols);
      }, 2000);
    });

    this.node.addEventListener('peer:discovery', (evt) => {
        const peerInfo = evt.detail;
        console.log('Discovered:', peerInfo.id.toString());
    });
    
    // Listen for pubsub messages
    (this.node.services.pubsub as any).addEventListener('message', (evt: any) => {
        const { topic, data } = evt.detail;
        if (topic === this.TOPIC_BLOCK) {
            this.handleBlockMessage(data);
        } else if (topic === this.TOPIC_TX) {
            this.handleTxMessage(data);
        } else if (topic === this.TOPIC_CONSENSUS) {
            try {
                const vote = JSON.parse(Buffer.from(data).toString());
                this.emit('vote', vote);
            } catch (e) {
                console.error('Failed to parse vote', e);
            }
        }
    });

    try {
        (this.node.services.pubsub as any).addEventListener('subscription-change', (evt: any) => {
            console.log(`[P2P] Subscription change: Peer ${evt.detail.peerId.toString()} subscribed to ${(evt.detail.subscriptions || []).map((s: any) => s.topic).join(', ')}`);
        });
    } catch {}

    // Subscribe to topics
    (this.node.services.pubsub as any).subscribe(this.TOPIC_BLOCK);
    (this.node.services.pubsub as any).subscribe(this.TOPIC_TX);
    (this.node.services.pubsub as any).subscribe(this.TOPIC_CONSENSUS);

    // Log subscriptions
    const pubsub = this.node.services.pubsub as any;
    setInterval(() => {
        const blockPeers = pubsub.getSubscribers(this.TOPIC_BLOCK);
        const txPeers = pubsub.getSubscribers(this.TOPIC_TX);
        const consensusPeers = pubsub.getSubscribers(this.TOPIC_CONSENSUS);
        console.log(`[P2P] Topic peers - Block: ${blockPeers.length}, Tx: ${txPeers.length}, Consensus: ${consensusPeers.length}, Connected: ${this.node?.getPeers().length}`);
    }, 5000);
  }

  get peerId(): string {
      return this.node?.peerId.toString() || '';
  }

  getPeers(): string[] {
      if (!this.node) return [];
      return this.node.getPeers().map(p => p.toString());
  }

  async stop() {
    await this.node?.stop();
  }

  async broadcastBlock(block: Block) {
    if (!this.node) return;
    const data = block.toJSON();
    const buffer = Buffer.from(JSON.stringify(data));
    const peers = (this.node.services.pubsub as any).getSubscribers(this.TOPIC_BLOCK);
    console.log(`Broadcasting block ${block.header.height} to ${peers.length} peers`);
    if (peers.length === 0) return;
    try {
      await (this.node.services.pubsub as any).publish(this.TOPIC_BLOCK, buffer);
    } catch (e: any) {
      if (e && typeof e.message === 'string' && e.message.includes('NoPeersSubscribedToTopic')) return;
      throw e;
    }
  }

  async broadcastTx(tx: Transaction) {
    if (!this.node) return;
    const data = tx.toJSON();
    const buffer = Buffer.from(JSON.stringify(data));
    const peers = (this.node.services.pubsub as any).getSubscribers(this.TOPIC_TX);
    console.log(`Broadcasting tx ${tx.hash.toString('hex')} to topic ${this.TOPIC_TX} (${peers.length} peers)`);
    if (peers.length === 0) return;
    try {
      await (this.node.services.pubsub as any).publish(this.TOPIC_TX, buffer);
    } catch (e: any) {
      if (e && typeof e.message === 'string' && e.message.includes('NoPeersSubscribedToTopic')) return;
      throw e;
    }
  }

  async broadcastVote(vote: any) {
    if (!this.node) return;
    const buffer = Buffer.from(JSON.stringify(vote));
    const peers = (this.node.services.pubsub as any).getSubscribers(this.TOPIC_CONSENSUS);
    if (peers.length === 0) return;
    try {
      await (this.node.services.pubsub as any).publish(this.TOPIC_CONSENSUS, buffer);
    } catch (e: any) {
      if (e && typeof e.message === 'string' && e.message.includes('NoPeersSubscribedToTopic')) return;
      throw e;
    }
  }

  private handleBlockMessage(data: Uint8Array) {
      try {
          const json = JSON.parse(Buffer.from(data).toString());
          console.log('Received block message');
          // We need a way to reconstruct Block from JSON. 
          // For now, emit raw data or reconstruction logic needs to be in Block class
          // Let's assume the consumer of this event will handle reconstruction/verification
          this.emit('block', json);
      } catch (e) {
          console.error('Failed to parse block message', e);
      }
  }

  private handleTxMessage(data: Uint8Array) {
      try {
          const json = JSON.parse(Buffer.from(data).toString());
          console.log('Received tx message:', json.hash);
          this.emit('tx', json);
      } catch (e) {
          console.error('Failed to parse tx message', e);
      }
  }
}
