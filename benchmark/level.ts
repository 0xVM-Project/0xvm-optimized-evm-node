import { Level } from 'level';
import { existsSync, rmSync } from 'fs';
import { randomBytes, keccak256 } from 'ethers';
import { expect } from 'chai';
const path = new URL('./benchdata', import.meta.url).toString().slice(8);
if (existsSync(path)) {
  rmSync(path, { force: true, recursive: true });
}
const db = new Level<string, any>(path, { valueEncoding: 'json' });
const defaultData = {
  name: 'test',
};
const keys = [];
const randomKey = () => {
  const raw = randomBytes(8);
  const key = keccak256(raw);
  keys.push(key);
  return { key, raw };
};
const writeSync = async (loop: number) => {
  const datas = [...Array(loop)].map((x) => ({
    ...defaultData,
    ...randomKey(),
  }));
  const begin = Date.now();
  console.time('writeSync');
  for (const data of datas) {
    await db.put(data.key, data);
  }
  console.log(`writeSync:${(loop / (Date.now() - begin)) * 1000} tps`);
  console.timeEnd('writeSync');
};
const readSync = async () => {
  const begin = Date.now();
  console.time('readSync');
  let total = 0;
  for (const key of keys) {
    const value = await db.get(key);
    expect(value.key).equal(key);
    total += 1;
  }
  console.log(`readSync:${(keys.length / (Date.now() - begin)) * 1000} qps`);
  console.timeEnd('readSync');
  return total;
};
const loop = 100_000;
await writeSync(loop);
await readSync();
