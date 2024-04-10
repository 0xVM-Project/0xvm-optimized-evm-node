import { Database, open } from 'lmdb';

import type { BatchDBOp, DB } from '@ethereumjs/util';

export class LMDB<TKey extends Uint8Array | string, TValue extends Uint8Array | string> implements DB<TKey, TValue> {
  readonly _path: string;
  readonly _database: Database<TValue, TKey>;

  constructor(path: string) {
    this._path = path;
    this._database = open({
      commitDelay: 10,
      noSync: false,
      cache: true,
      compression: false,
      name: '@ethereumjs/trie',
      path,
      //maxReaders: 1024 * 1024,
    });
  }

  async get(key: TKey): Promise<TValue | undefined> {
    return this._database.get(key);
  }

  async put(key: TKey, val: TValue): Promise<void> {
    void this._database.put(key, val);
  }

  async del(key: TKey): Promise<void> {
    void this._database.remove(key);
  }

  async batch(opStack: BatchDBOp<TKey, TValue>[]): Promise<void> {
    for (const op of opStack) {
      if (op.type === 'put') {
        await this.put(op.key, op.value);
      }

      if (op.type === 'del') {
        await this.del(op.key);
      }
    }
  }

  shallowCopy(): DB<TKey, TValue> {
    return new LMDB(this._path);
  }

  open() {
    return Promise.resolve();
  }
  keys() {
    return this._database.getKeys().asArray;
  }
  async committed() {
    return await this._database.committed;
  }
}
