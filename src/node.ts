import restana from 'restana';
import cors from 'cors';
import bodyParser from 'body-parser';
import { vm } from './vm/vm';
import { ethers } from 'ethers';
const app = restana();
await vm.createInstance();

// middleware
app.use(cors()); // Allow cross domain
app.use((req, res, next) => {
  return new Promise((resolve) => {
    bodyParser.text()(req, res, (err) => resolve(next(err)));
  });
}); // By default the Body is parsed as a string
app.use((req, res, next) => {
  return new Promise((resolve) => {
    bodyParser.urlencoded({ extended: false })(req, res, (err) => resolve(next(err)));
  });
}); // Body as urlencoded
app.use((req, res, next) => {
  return new Promise((resolve) => {
    bodyParser.json()(req, res, (err) => resolve(next(err)));
  });
}); // Parsing of Json format

// routing
app.get('/health', async (q, s) => {
  s.send({ success: true, timestamp: Date.now() }, 200);
});
app.post('/deploy', async (q, s) => {
  if (q.body) {
    const data = q.body as { bytecode: string; argv: string };
    try {
      const rept = await vm.deploy(data.bytecode, data.argv);
      s.send({ success: !!rept, timestamp: Date.now(), address: rept }, 200);
    } catch (err) {
      s.send({ success: false, timestamp: Date.now(), error: `${(err as Error).message}` }, 400);
    }
  } else s.send({ success: false }, 400);
});
app.post('/write', async (q, s) => {
  if (q.body) {
    const data = q.body as { contract: string; params: string; value: string | undefined };
    try {
      const { returns, logs } = await vm.write(data.contract, data.params, data.value);
      s.send({ success: true, timestamp: Date.now(), returns, logs }, 200);
    } catch (err) {
      s.send({ success: false, timestamp: Date.now(), error: `${(err as Error).message}` }, 400);
    }
  } else s.send({ success: false }, 400);
});
app.post('/read', async (q, s) => {
  if (q.body) {
    const data = q.body as { contract: string; params: string };
    const { returns } = await vm.read(data.contract, data.params);
    s.send({ success: !!returns, timestamp: Date.now(), returns }, 200);
  } else s.send({ success: false }, 400);
});

export { app as node };
