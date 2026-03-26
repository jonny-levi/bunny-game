export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://bunny:bunny@localhost:5432/bunny_family',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  familyName: process.env.FAMILY_NAME || 'The Bunny Family',
};
