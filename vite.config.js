import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      {
        name: 'api-serverless-local',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && (
            req.url.startsWith('/api/send-whatsapp-signup') ||
            req.url.startsWith('/api/telecom-lookup') ||
            req.url.startsWith('/api/directd') ||
            req.url.startsWith('/api/infosimples') ||
            req.url.startsWith('/api/aprovar-cliente')
          )) {
            try {
              const urlObj = new URL(req.url, 'http://localhost');
              req.query = Object.fromEntries(urlObj.searchParams.entries());

              let bodyStr = '';
              req.on('data', chunk => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                try {
                  req.body = bodyStr ? JSON.parse(bodyStr) : {};
                } catch {
                  // Se for form-urlencoded (Infosimples)
                  req.body = bodyStr || {};
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

                if (req.url.startsWith('/api/telecom-lookup')) {
                  const { default: telecomHandler } = await import('./api/telecom-lookup.js');
                  await telecomHandler(req, res);
                } else if (req.url.startsWith('/api/directd')) {
                  const { default: directdHandler } = await import('./api/directd.js');
                  await directdHandler(req, res);
                } else if (req.url.startsWith('/api/infosimples')) {
                  const { default: infosimplesHandler } = await import('./api/infosimples.js');
                  await infosimplesHandler(req, res);
                } else if (req.url.startsWith('/api/aprovar-cliente')) {
                  const { default: aprovarHandler } = await import('./api/aprovar-cliente.js');
                  await aprovarHandler(req, res);
                } else {
                  const { default: handler } = await import('./api/send-whatsapp-signup.js');
                  await handler(req, res);
                }
              });
            } catch (err) {
              console.error('Erro no middleware local de API:', err);
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
  }
};
});



