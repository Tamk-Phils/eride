import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function wipePublicSchema() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL...');
    await client.query('DROP SCHEMA public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('✅ Public schema completely wiped and recreated.');
  } catch (error) {
    console.error('❌ Error wiping schema:', error);
  } finally {
    await client.end();
  }
}

wipePublicSchema();
