import * as dotenv from 'dotenv';
import * as path from 'path';
import { IntegrationConfig } from '../src/config';

if (process.env.LOAD_ENV) {
  dotenv.config({
    path: path.join(__dirname, '../.env'),
  });
}
const DEFAULT_EMAIL = 'dummy-sigsci-api-user';
const DEFAULT_PASSWORD = 'dummy-sigsci-api-password';

export const integrationConfig: IntegrationConfig = {
  email: process.env.EMAIL || DEFAULT_EMAIL,
  password: process.env.PASSWORD || DEFAULT_PASSWORD,
};
