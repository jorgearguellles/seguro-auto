export default () => ({
  'users-permissions': {
    enabled: true,
    config: {
      jwtSecret: process.env.JWT_SECRET ?? 'CHANGE_ME_JWT_SECRET',
    },
  },
});
