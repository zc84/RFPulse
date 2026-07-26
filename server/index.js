import 'dotenv/config';
import { createApp } from './app.js';
import { createProductionVisualModule } from './visuals/createVisualModule.js';

const PORT = process.env.PORT || 3000;
const visualModule = await createProductionVisualModule();
const app = createApp({ visualModule });

const server = app.listen(PORT, () => {
  console.log(`RFPulse API running on http://localhost:${PORT}`);
});

server.on('error', err => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      [
        `RFPulse API could not start because port ${PORT} is already in use.`,
        `Stop the existing process on port ${PORT} and retry.`,
        `Hint: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`,
      ].join('\n')
    );
    process.exit(1);
  }

  console.error(err);
  process.exit(1);
});
