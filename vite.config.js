import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-serverless-local',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/send-whatsapp-signup')) {
            try {
              let bodyStr = '';
              req.on('data', chunk => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                try {
                  req.body = bodyStr ? JSON.parse(bodyStr) : {};
                } catch {
                  req.body = {};
                }
                // Adiciona helper status() e json() comuns a serverless handlers
                res.status = (code) => {
                  res.statusCode = code;
                  return res;
                };
                res.json = (data) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return res;
                };
                const { default: handler } = await import('./api/send-whatsapp-signup.js');
                await handler(req, res);
              });
            } catch (err) {
              console.error('Erro no middleware local de WhatsApp:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
  server: {
    host: true, // Expõe o servidor para a rede local (0.0.0.0)
    proxy: {
      '/api-infosimples': {
        target: 'https://api.infosimples.com/api/v2/consultas',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-infosimples/, '')
      },
      '/api-directd': {
        target: 'https://apiv3.directd.com.br/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-directd/, '')
      }
    }
  },
})

