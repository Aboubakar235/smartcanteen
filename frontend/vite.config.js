import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// `npm run dev:mobile` sert l'application en HTTPS sur le réseau local : un
// téléphone peut alors l'ouvrir et utiliser sa caméra (scan des QR codes).
export default defineConfig(({ mode }) => {
  const mobile = mode === 'mobile'
  return {
    plugins: mobile ? [react(), basicSsl({ name: 'smartcanteen-local' })] : [react()],
    server: {
      host: mobile ? true : undefined,
      // Liens de test publics : `cloudflared tunnel --url http://localhost:5173`, ou
      // `ssh -R 80:localhost:5173 nokey@localhost.run` si le réseau bloque Cloudflare
      allowedHosts: ['.trycloudflare.com', '.lhr.life', '.localhost.run'],
      // Les appels /api passent par Vite : même adresse que la page, donc pas
      // de contenu mixte en HTTPS ni de « localhost » côté téléphone.
      proxy: {
        '/api': { target: 'http://localhost:4000', changeOrigin: true },
      },
    },
    // `npm run preview` : version de production (quelques fichiers compressés),
    // bien plus rapide à travers un tunnel que le serveur de développement.
    preview: {
      allowedHosts: ['.trycloudflare.com', '.lhr.life', '.localhost.run'],
      proxy: {
        '/api': { target: 'http://localhost:4000', changeOrigin: true },
      },
    },
  }
})
