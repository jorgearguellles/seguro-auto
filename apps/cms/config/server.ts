export default () => ({
  host: process.env.HOST ?? '0.0.0.0',
  port: parseInt(process.env.PORT ?? '1337', 10),
  app: {
    keys: (process.env.APP_KEYS ?? 'CHANGE_ME_KEY1,CHANGE_ME_KEY2').split(','),
  },
});
