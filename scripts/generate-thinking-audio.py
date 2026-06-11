import os
import shutil
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
OUTPUT_ROOT = ROOT_DIR / "frontend" / "public" / "audio"

sys.path.insert(0, str(BACKEND_DIR))

from app.adapters.tts import KokoroTextToSpeech  # noqa: E402
from app.config import get_settings  # noqa: E402


PHRASE_BANKS = {
    "thinking": [
        ("dejame-buscar-eso", "Déjame buscar eso."),
        ("buena-pregunta", "Buena pregunta."),
        ("voy-a-pensarlo", "Voy a pensarlo."),
        ("un-momento", "Un momento."),
        ("estoy-explorando", "Estoy explorando."),
        ("vamos-a-ver", "Vamos a ver."),
        ("estoy-investigando", "Estoy investigando."),
        ("dame-un-segundito", "Dame un segundito."),
        ("que-interesante", "Qué interesante."),
        ("voy-a-revisarlo", "Voy a revisarlo."),
        ("ya-casi-lo-tengo", "Ya casi lo tengo."),
        ("pensemos-juntos", "Pensemos juntos."),
        ("me-gusta-esa-pregunta", "Me gusta esa pregunta."),
        ("estoy-conectando-ideas", "Estoy conectando ideas."),
        ("dejame-imaginarlo", "Déjame imaginarlo."),
        ("buscando-pistas", "Estoy buscando pistas."),
        ("que-curioso", "Qué curioso."),
        ("exploremos-eso", "Exploremos eso."),
        ("tengo-una-idea", "Tengo una idea."),
        ("voy-paso-a-paso", "Voy paso a paso."),
    ],
    "wake": [
        ("aqui-estoy", "Aquí estoy."),
        ("hola-explorador", "Hola, explorador."),
        ("lista-para-escuchar", "Lista para escuchar."),
        ("te-escucho", "Te escucho."),
        ("dime-tu-pregunta", "Dime tu pregunta."),
    ],
    "recording": [
        ("adelante", "Adelante."),
        ("cuentame", "Cuéntame."),
        ("dime", "Dime."),
        ("te-escucho", "Te escucho."),
        ("preguntame", "Pregúntame."),
    ],
    "retry": [
        ("no-alcance-a-escucharte", "No alcancé a escucharte."),
        ("puedes-repetirlo", "¿Puedes repetirlo?"),
        ("intentemos-otra-vez", "Intentemos otra vez."),
        ("habla-un-poquito-mas-fuerte", "Habla un poquito más fuerte."),
        ("probemos-de-nuevo", "Probemos de nuevo."),
    ],
}


def main() -> None:
    os.environ.setdefault("PYTHONPYCACHEPREFIX", str(BACKEND_DIR / ".pycache"))
    tts = KokoroTextToSpeech(get_settings())
    for bank, phrases in PHRASE_BANKS.items():
        output_dir = OUTPUT_ROOT / bank
        output_dir.mkdir(parents=True, exist_ok=True)

        for slug, phrase in phrases:
            generated_path = tts.synthesize(phrase)
            output_path = output_dir / f"{slug}.wav"
            shutil.copyfile(generated_path, output_path)
            generated_path.unlink(missing_ok=True)
            print(f"{output_path.relative_to(ROOT_DIR)}: {phrase}")


if __name__ == "__main__":
    main()
