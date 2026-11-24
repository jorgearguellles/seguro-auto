export default () => ({
  apiToken: {
    salt: process.env.API_TOKEN_SALT ?? 'CHANGE_ME_API_TOKEN_SALT',
  },
  transfer: {
    token: {
      salt: process.env.TRANSFER_TOKEN_SALT ?? 'CHANGE_ME_TRANSFER_TOKEN_SALT',
    },
  },
  auth: {
    secret: process.env.ADMIN_JWT_SECRET ?? 'CHANGE_ME_ADMIN_JWT_SECRET',
  },
  url: '/admin',
  watchIgnoreFiles: ['**/config/sync/**'],
});
