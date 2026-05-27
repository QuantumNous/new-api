import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '43200', 10),
  databaseUrl: process.env.DATABASE_URL || '',
};
