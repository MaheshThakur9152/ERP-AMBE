import app from './app';
import { env } from './config/env';
import { supabaseAdmin } from './config/supabase';

const PORT = parseInt(env.PORT, 10) || 5000;

/**
 * Connection Pool Warmup: Executes a lightweight query on server startup to warm up DB sockets/connection pool.
 */
async function warmupDbConnection() {
  try {
    const { error } = await supabaseAdmin.from('companies').select('id').limit(1);
    if (error) {
      console.warn('⚠️ DB Connection pool warmup warning:', error.message);
    } else {
      console.log('✅ DB Connection pool warmed up successfully');
    }
  } catch (err: any) {
    console.warn('⚠️ DB Connection pool warmup error:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 ERP Backend API listening on port ${PORT} [${env.NODE_ENV}]`);
  warmupDbConnection();
});
