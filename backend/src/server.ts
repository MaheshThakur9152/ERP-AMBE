import app from './app';
import { env } from './config/env';

const PORT = parseInt(env.PORT, 10) || 5000;

app.listen(PORT, () => {
  console.log(`🚀 ERP Backend API listening on port ${PORT} [${env.NODE_ENV}]`);
});
