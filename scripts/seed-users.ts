import { db } from '../src/lib/db/client';
import { hashPassword } from '../src/lib/auth/password';

async function main() {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;

  if (!defaultPassword) {
    throw new Error('Falta SEED_DEFAULT_PASSWORD');
  }

  const users = [
    { name: 'Gonzalo Cuevas', email: 'gonzalo@gecorp.cl' },
    { name: 'Monica Gutierrez', email: 'monica@gecorp.cl' },
    { name: 'Leon', email: 'leon@gecorp.cl' },
    { name: 'Patricio Echenique', email: 'patricio@gecorp.cl' },
  ];

  for (const user of users) {
    const passwordHash = await hashPassword(defaultPassword);
    await db.query(
      `insert into users (name, email, password_hash, role)
       values ($1, $2, $3, 'operativo')
       on conflict (email) do update
       set name = excluded.name,
           password_hash = excluded.password_hash,
           role = excluded.role,
           active = true,
           updated_at = now()`,
      [user.name, user.email, passwordHash],
    );
  }

  console.log('Usuarios semilla cargados OK');
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
