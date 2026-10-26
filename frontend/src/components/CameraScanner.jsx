import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// Lecteur de QR Code par la caméra (EF-29). Utilise le détecteur natif du
// navigateur quand il existe (Chrome, Android), sinon jsQR (Safari, iPhone).
const INTERVALLE_MS = 180;
const MEME_CODE_IGNORE_MS = 4000;

function messageErreur(err) {
  if (!window.isSecureContext) {
    return "La caméra n'est accessible que sur une page sécurisée (https) ou sur localhost. Utilisez la saisie manuelle.";
  }
  if (err?.name === "NotAllowedError") {
    return "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, ou utilisez la saisie manuelle.";
  }
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
    return "Aucune caméra n'a été trouvée sur cet appareil. Utilisez la saisie manuelle.";
  }
  return "Impossible de démarrer la caméra. Utilisez la saisie manuelle.";
}

export default function CameraScanner({ onCode, enPause = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onCodeRef = useRef(onCode);
  const pauseRef = useRef(enPause);
  const dernierRef = useRef({ code: null, quand: 0 });
  const [etat, setEtat] = useState("demarrage"); // demarrage | actif | erreur
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    onCodeRef.current = onCode;
    pauseRef.current = enPause;
  }, [onCode, enPause]);

  useEffect(() => {
    let flux = null;
    let minuteur = null;
    let arrete = false;
    let detecteur =
      "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;

    async function lireImage() {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return null;
      if (detecteur) {
        try {
          const codes = await detecteur.detect(video);
          if (codes[0]?.rawValue) return codes[0].rawValue;
        } catch {
          detecteur = null; // détecteur natif défaillant : jsQR prend le relais
        }
      }
      // jsQR en complément : certains détecteurs natifs ratent des codes lisibles
      const canvas = canvasRef.current;
      const largeur = video.videoWidth;
      const hauteur = video.videoHeight;
      canvas.width = largeur;
      canvas.height = hauteur;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, largeur, hauteur);
      const image = ctx.getImageData(0, 0, largeur, hauteur);
      return jsQR(image.data, largeur, hauteur, { inversionAttempts: "dontInvert" })?.data ?? null;
    }

    async function boucle() {
      if (arrete) return;
      try {
        if (!pauseRef.current) {
          const code = await lireImage();
          const { code: dernier, quand } = dernierRef.current;
          // Le même ticket reste souvent devant la caméra : on ne le renvoie pas en boucle.
          if (code && (code !== dernier || Date.now() - quand > MEME_CODE_IGNORE_MS)) {
            dernierRef.current = { code, quand: Date.now() };
            navigator.vibrate?.(60);
            onCodeRef.current(code);
          }
        }
      } catch {
        // Image illisible : on retente à l'image suivante.
      }
      minuteur = setTimeout(boucle, INTERVALLE_MS);
    }

    async function demarrer() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("indisponible");
        flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (arrete) {
          flux.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = flux;
        await video.play();
        setEtat("actif");
        boucle();
      } catch (err) {
        if (arrete) return;
        setErreur(messageErreur(err));
        setEtat("erreur");
      }
    }

    demarrer();
    return () => {
      arrete = true;
      clearTimeout(minuteur);
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (etat === "erreur") {
    return (
      <div className="camera camera-erreur" role="alert">
        <p>{erreur}</p>
      </div>
    );
  }

  return (
    <div className={`camera ${enPause ? "en-pause" : ""}`}>
      <video ref={videoRef} className="camera-video" playsInline muted aria-label="Image de la caméra" />
      <canvas ref={canvasRef} hidden />
      <div className="camera-viseur" aria-hidden="true">
        <span className="coin hg" />
        <span className="coin hd" />
        <span className="coin bg" />
        <span className="coin bd" />
        {etat === "actif" && !enPause && <span className="camera-ligne" />}
      </div>
      <p className="camera-aide" aria-live="polite">
        {etat === "demarrage" ? "Démarrage de la caméra…" : enPause ? "Vérification…" : "Placez le QR code dans le cadre"}
      </p>
    </div>
  );
}
