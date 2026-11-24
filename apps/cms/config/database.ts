import path from 'path';

export default () => ({
  connection: {
    client: 'better-sqlite3',
    connection: {
      filename: path.join(
        __dirname,
        '..',
        process.env.DATABASE_FILENAME ?? '.tmp/data.db'
      ),
    },
    useNullAsDefault: true,
  },
});
