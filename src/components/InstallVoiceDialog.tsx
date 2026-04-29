import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { detectOS, type VoiceGender } from "@/hooks/useSpeech";
import { ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gender: VoiceGender;
}

const InstallVoiceDialog = ({ open, onOpenChange, gender }: Props) => {
  const os = detectOS();
  const label = gender === "female" ? "femenina" : "masculina";

  const instructions: Record<string, { title: string; steps: string[]; link?: { href: string; label: string } }> = {
    windows: {
      title: "Windows 10 / 11",
      steps: [
        "Abre Configuración → Hora e idioma → Idioma y región.",
        'Pulsa "Agregar un idioma" y elige Español (España, México, etc.).',
        'Marca la casilla "Texto a voz" antes de instalar.',
        "Una vez instalado, ve a Accesibilidad → Narrador → Voces para ver las disponibles.",
        `Si solo aparece una voz, descarga voces adicionales del género ${label} desde la misma sección.`,
        "Reinicia el navegador y vuelve a esta app.",
      ],
    },
    macos: {
      title: "macOS",
      steps: [
        "Abre Ajustes del Sistema → Accesibilidad → Contenido hablado.",
        'Haz clic en "Voz del sistema" → "Gestionar voces…".',
        `En la lista, busca voces en español ${label === "femenina" ? "(Mónica, Paulina, Marisol)" : "(Jorge, Diego, Juan)"} y márcalas para descargar.`,
        "Espera a que termine la descarga (pueden ser cientos de MB).",
        "Reinicia el navegador y vuelve a esta app.",
      ],
    },
    ios: {
      title: "iPhone / iPad",
      steps: [
        "Abre Ajustes → Accesibilidad → Contenido hablado → Voces.",
        "Toca Español y elige una voz para descargar.",
        `Para voz ${label}, busca ${gender === "female" ? "Mónica, Paulina o Marisol" : "Jorge o Diego"}.`,
        'Recomendado: usa la versión "Mejorada" o "Premium" para mejor calidad.',
        "Vuelve al navegador y recarga la app.",
      ],
    },
    android: {
      title: "Android",
      steps: [
        "Abre Ajustes → Sistema → Idiomas e introducción de texto → Salida de texto a voz.",
        'Toca el motor (normalmente "Speech Services de Google") → ajustes → Instalar datos de voz.',
        `Selecciona Español y descarga las voces. Para ${label}, instala todas las disponibles del idioma — Android no siempre etiqueta el género.`,
        "Vuelve al navegador y recarga la app.",
      ],
      link: {
        href: "https://play.google.com/store/apps/details?id=com.google.android.tts",
        label: "Speech Services de Google (Play Store)",
      },
    },
    linux: {
      title: "Linux",
      steps: [
        "Instala espeak-ng o festvox: sudo apt install espeak-ng festival festvox-ellpc11k",
        "Para voces más naturales considera Mimic 3 o Piper TTS.",
        "Reinicia el navegador después de instalar.",
      ],
    },
    unknown: {
      title: "Instalar voz en español",
      steps: [
        "Las voces TTS las gestiona tu sistema operativo, no el navegador.",
        "Busca en los ajustes de tu dispositivo: Accesibilidad → Texto a voz / Contenido hablado.",
        `Descarga una voz en español del género ${label} y reinicia el navegador.`,
      ],
    },
  };

  const info = instructions[os];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Voz {label} no encontrada</DialogTitle>
          <DialogDescription>
            Tu sistema no tiene una voz en español del género elegido. Por seguridad del navegador,
            esta app no puede instalar voces directamente — debes hacerlo desde tu sistema operativo.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <h3 className="mb-2 text-sm font-semibold">{info.title}</h3>
          <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted-foreground">
            {info.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {info.link && (
            <a
              href={info.link.href}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              {info.link.label}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <p className="mt-3 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
          Mientras tanto, la app usa la mejor voz disponible y ajusta el tono para aproximarse al género elegido.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default InstallVoiceDialog;
