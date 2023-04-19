module.exports = {
    apps : [
      {
        name: 'app',
        script: 'npx',
        args: 'vite-node src/index.ts',
        interpreter: 'none',
        exec_mode: 'fork',
        env: {
          NODE_ENV: 'production'
        }
      }
    ]
  }
  