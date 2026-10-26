import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// Les appels /api passent par Vite : même adresse que la page, donc pas de
// contenu mixte en HTTPS ni de « localhost » côté téléphone.
const proxy = {
  '/api': { target: 'http://localhost:4000', changeOrigin: true },
}

// `npm run dev:mobile` sert l'application en HTTPS sur le réseau local : un
// téléphone peut alors l'ouvrir et utiliser sa caméra (scan des QR codes).
export default defineConfig(({ mode }) => {
  const mobile = mode === 'mobile'
  return {
    plugins: mobile ? [react(), basicSsl({ name: 'smartcanteen-local' })] : [react()],
    server: { host: mobile ? true : undefined, proxy },
    preview: { proxy },
  }
})
