import path from 'path';

const dbFile = process.env.DATABASE_FILENAME ?? '.tmp/data.db';

export default () => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.isAbsolute(dbFile)
        ? dbFile
        : path.join(__dirname, '..', dbFile),
    },
    useNullAsDefault: true,
  },
});
